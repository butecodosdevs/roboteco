import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Collection, PermissionFlagsBits } from 'discord.js';
import { and, eq, sql } from 'drizzle-orm';
import '@/app.module';
import { closeCache } from '@/cache';
import { CapabilityError, capability, inject, invokeCapability, type PluginScope } from '@/core';
import { closeDb, db, schema } from '@/db';
import { DiscordDataService } from '@/modules/plugins/discord-data.service';
import { PluginHostService } from '@/modules/plugins/plugin-host.service';
import { fakeServer } from './fakes';

const guilds = new Collection<string, unknown>();
const created: string[] = [];

/** Calls a capability the way the engine does: caller check, input validation, output schema. */
async function call(name: string, scope: PluginScope, input: unknown): Promise<any> {
  const cap = capability(name);
  assert.ok(cap, `capability ${name} exists`);
  return invokeCapability(cap, scope, input, (t) => inject(t));
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CapabilityError) return error.code;
    throw error;
  }
  return 'no refusal';
}

function server() {
  const s = fakeServer();
  guilds.set(s.guild.id, s.guild);
  created.push(s.guild.id);
  return s;
}

before(() => {
  inject(DiscordDataService).attach({ guilds: { cache: guilds } } as never);
});

after(async () => {
  for (const guildId of created) {
    await inject(PluginHostService).purgeGuild(guildId);
    await db.delete(schema.memberLevels).where(eq(schema.memberLevels.guildId, guildId));
    await db.delete(schema.moderationCases).where(eq(schema.moderationCases.guildId, guildId));
    await db
      .delete(schema.scheduledJobs)
      .where(sql`${schema.scheduledJobs.payload}->>'guildId' = ${guildId}`);
    await db.delete(schema.guilds).where(eq(schema.guilds.id, guildId));
  }
  await closeDb();
  await closeCache();
});

test('kv: 20 concurrent increments end at 20, and a non-number is refused', async () => {
  const scope = server().scope();
  await Promise.all(Array.from({ length: 20 }, () => call('kv.increment', scope, { key: 'hits' })));
  assert.deepEqual(await call('kv.get', scope, { key: 'hits' }), { value: '20' });
  await call('kv.set', scope, { key: 'name', value: 'ana' });
  assert.equal(await refusal(call('kv.increment', scope, { key: 'name' })), 'not_a_number');
});

test('kv: spaces are per plugin and server, and list treats % and _ literally', async () => {
  const s = server();
  const scope = s.scope();
  await call('kv.set', scope, { key: 'a%b', value: '1' });
  await call('kv.set', scope, { key: 'axb', value: '1' });
  assert.deepEqual((await call('kv.list', scope, { prefix: 'a%' })).keys, ['a%b']);
  const otherPlugin = { ...scope, pluginId: 'other-plugin' };
  assert.deepEqual(await call('kv.get', otherPlugin, { key: 'axb' }), { value: null });
});

test('kv: the 1000-key limit holds under concurrent writes of new keys', async () => {
  const scope = server().scope();
  await db.insert(schema.pluginKv).values(
    Array.from({ length: 995 }, (_, i) => ({
      pluginId: scope.pluginId,
      guildId: scope.guildId,
      key: `k${i}`,
      value: 'x',
    })),
  );
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      refusal(call('kv.set', scope, { key: `new${i}`, value: 'x' })),
    ),
  );
  assert.equal(results.filter((r) => r === 'storage_full').length, 5);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.pluginKv)
    .where(
      and(eq(schema.pluginKv.pluginId, scope.pluginId), eq(schema.pluginKv.guildId, scope.guildId)),
    );
  assert.equal(row?.n, 1000);
  // Overwriting an existing key is still allowed when full.
  await call('kv.set', scope, { key: 'k1', value: 'y' });
});

test('kv: erasing a user removes keys that mention them, in that server only', async () => {
  const a = server().scope();
  const b = server().scope();
  await call('kv.set', a, { key: 'count:123456789012345678', value: '3' });
  await call('kv.set', a, { key: 'count:999999999999999999', value: '1' });
  await call('kv.set', b, { key: 'count:123456789012345678', value: '7' });
  await inject(PluginHostService).eraseUser('123456789012345678', a.guildId);
  assert.deepEqual((await call('kv.list', a, { prefix: 'count:' })).keys, [
    'count:999999999999999999',
  ]);
  assert.equal((await call('kv.get', b, { key: 'count:123456789012345678' })).value, '7');
});

test('xp.grant: a plugin can give one member at most 100 XP per window, even in a loop', async () => {
  const s = server();
  const scope = s.scope({ userId: '200000000000000001' });
  const first = await call('xp.grant', scope, { amount: 60 });
  assert.equal(first.remaining, 40);
  assert.equal(await refusal(call('xp.grant', scope, { amount: 50 })), 'xp_limit');
  await call('xp.grant', scope, { amount: 40 });
  assert.equal(await refusal(call('xp.grant', scope, { amount: 1 })), 'xp_limit');
  // Another member has their own budget; the refused grants were not applied.
  await call('xp.grant', scope, { userId: '200000000000000002', amount: 100 });
  const [row] = await db
    .select()
    .from(schema.memberLevels)
    .where(
      and(
        eq(schema.memberLevels.guildId, scope.guildId),
        eq(schema.memberLevels.userId, '200000000000000001'),
      ),
    );
  assert.equal(row?.xp, 100);
});

test('xp.grant: an event (no caller) must say who gets the XP', async () => {
  const scope = server().scope(null);
  assert.equal(await refusal(call('xp.grant', scope, { amount: 5 })), 'no_member');
});

test('moderation.history needs a caller with Moderate Members', async () => {
  const s = server();
  const member = s.scope({ userId: '200000000000000003', permissions: [] });
  assert.equal(
    await refusal(call('moderation.history', member, { userId: '200000000000000004' })),
    'caller_forbidden',
  );
  const staff = s.scope({
    userId: '200000000000000003',
    permissions: [PermissionFlagsBits.ModerateMembers],
  });
  assert.equal(
    (await call('moderation.history', staff, { userId: '200000000000000004' })).total,
    0,
  );
});

test('roles: plain roles for anyone, staff roles only for a staff caller above them', async () => {
  const s = server();
  s.role('300000000000000001', 5, []);
  s.role('300000000000000002', 6, [PermissionFlagsBits.BanMembers]);
  s.role('300000000000000003', 40, [PermissionFlagsBits.ManageRoles]);
  s.member('200000000000000010');
  s.member('200000000000000011', ['300000000000000003']);
  const plain = { userId: '200000000000000010', roleId: '300000000000000001' };
  const staffRole = { userId: '200000000000000010', roleId: '300000000000000002' };

  const member = s.scope({ userId: '200000000000000010' });
  assert.deepEqual(await call('discord.roles.add', member, plain), { changed: true });
  assert.equal(await refusal(call('discord.roles.add', member, staffRole)), 'caller_forbidden');
  // Events have no caller: still no staff roles.
  assert.equal(
    await refusal(call('discord.roles.add', s.scope(null), staffRole)),
    'caller_forbidden',
  );

  const manager = s.scope({ userId: '200000000000000011' });
  assert.deepEqual(await call('discord.roles.add', manager, staffRole), { changed: true });
  assert.deepEqual(s.roleChanges, [
    '+300000000000000001:200000000000000010',
    '+300000000000000002:200000000000000010',
  ]);
});

test('roles: a role above the bot is refused even for staff', async () => {
  const s = server();
  s.role('300000000000000004', 60, []);
  s.member('200000000000000012');
  assert.equal(
    await refusal(
      call('discord.roles.add', s.scope(null), {
        userId: '200000000000000012',
        roleId: '300000000000000004',
      }),
    ),
    'bot_hierarchy',
  );
});

test('messages: a member can only post where they could post, and only edit what the plugin posted', async () => {
  const s = server();
  s.member('200000000000000020');
  s.channel('400000000000000001');
  s.channel('400000000000000002', { '200000000000000020': [PermissionFlagsBits.SendMessages] });
  const scope = s.scope({ userId: '200000000000000020' }, '400000000000000001');

  const posted = await call('discord.messages.send', scope, { content: 'hi @everyone' });
  assert.equal(posted.channelId, '400000000000000001');
  assert.deepEqual(s.sent[0]?.payload.allowedMentions, { parse: [] });
  assert.equal(
    await refusal(
      call('discord.messages.send', scope, { channelId: '400000000000000002', content: 'x' }),
    ),
    'caller_forbidden',
  );

  await call('discord.messages.edit', scope, { ...posted, content: 'edited' });
  assert.equal(
    await refusal(
      call('discord.messages.edit', scope, {
        channelId: '400000000000000001',
        messageId: '400000000000000999',
        content: 'not mine',
      }),
    ),
    'not_owner',
  );
  const otherPlugin = { ...scope, pluginId: 'other-plugin' };
  assert.equal(
    await refusal(call('discord.messages.edit', otherPlugin, { ...posted, content: 'x' })),
    'not_owner',
  );
});

test('dm.send: at most 5 DMs per member per plugin per hour', async () => {
  const s = server();
  s.member('200000000000000030');
  const scope = s.scope(null);
  for (let i = 0; i < 5; i++) {
    await call('discord.dm.send', scope, { userId: '200000000000000030', content: `n${i}` });
  }
  assert.equal(
    await refusal(call('discord.dm.send', scope, { userId: '200000000000000030', content: 'x' })),
    'dm_limit',
  );
  assert.equal(s.dms.length, 5);
});

test('moderation.ban: the caller needs Ban Members, must outrank the target, and the case says it was the plugin', async () => {
  const s = server();
  s.role('300000000000000010', 10, [PermissionFlagsBits.BanMembers]);
  s.role('300000000000000011', 20, []);
  s.member('200000000000000040', ['300000000000000010']);
  s.member('200000000000000041');
  s.member('200000000000000042', ['300000000000000011']);

  const plain = s.scope({ userId: '200000000000000041' });
  assert.equal(
    await refusal(call('moderation.ban', plain, { userId: '200000000000000042' })),
    'caller_forbidden',
  );

  const moderator = s.scope({
    userId: '200000000000000040',
    permissions: [PermissionFlagsBits.BanMembers],
  });
  // The target holds a higher role than the moderator.
  assert.equal(
    await refusal(call('moderation.ban', moderator, { userId: '200000000000000042' })),
    'refused',
  );
  const result = await call('moderation.ban', moderator, {
    userId: '200000000000000041',
    reason: 'spam',
  });
  assert.ok(s.bans.has('200000000000000041'));
  const [entry] = await db
    .select()
    .from(schema.moderationCases)
    .where(eq(schema.moderationCases.guildId, s.guild.id));
  assert.equal(entry?.number, result.case);
  assert.equal(entry?.moderatorId, '200000000000000040');
  assert.match(entry?.reason ?? '', /spam.*test-plugin/);
});

test('moderation from an event acts as the bot', async () => {
  const s = server();
  s.member('200000000000000050');
  const result = await call('moderation.warn', s.scope(null), {
    userId: '200000000000000050',
    reason: 'auto',
  });
  const [entry] = await db
    .select()
    .from(schema.moderationCases)
    .where(eq(schema.moderationCases.guildId, s.guild.id));
  assert.equal(entry?.number, result.case);
  assert.equal(entry?.moderatorId, s.guild.client.user.id);
});

test('schedule: a key replaces the earlier run, cancel removes it, and times are bounded', async () => {
  const scope = server().scope(null);
  await call('schedule.create', scope, { key: 'daily', seconds: 60, data: { n: 1 } });
  await call('schedule.create', scope, { key: 'daily', seconds: 120, data: { n: 2 } });
  const { runs } = await call('schedule.list', scope, {});
  assert.equal(runs.length, 1);
  const [row] = await db
    .select({ payload: schema.scheduledJobs.payload })
    .from(schema.scheduledJobs)
    .where(sql`${schema.scheduledJobs.payload}->>'guildId' = ${scope.guildId}`);
  assert.deepEqual((row?.payload as { data: unknown } | undefined)?.data, { n: 2 });
  assert.deepEqual(await call('schedule.cancel', scope, { key: 'daily' }), { cancelled: true });
  assert.equal(
    await refusal(
      call('schedule.create', scope, { at: new Date(Date.now() + 1000).toISOString() }),
    ),
    'invalid_time',
  );
});

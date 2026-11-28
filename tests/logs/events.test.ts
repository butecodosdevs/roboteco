import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import {
  AuditLogEvent,
  Collection,
  OverwriteType,
  PermissionFlagsBits,
  PermissionsBitField,
} from 'discord.js';
import { eq } from 'drizzle-orm';
import '@/app.module';
import { closeCache } from '@/cache';
import { inject } from '@/core';
import { closeDb, db, schema, updateGuildSettings } from '@/db';
import { AuditService } from '@/modules/logs/audit.service';
import { LogsService } from '@/modules/logs/logs.service';
import { uniqueGuildId } from '../plugins/fakes';

// The log module posts plain-text lines (emoji + time + sentence) to the configured channel.
// These tests assert the stable contract — whether a line is posted, and the ids/text it carries —
// not the translated wording, which lives in the locale files.
const service = new LogsService();
const LOG = 'logchan00000000001';
const created: string[] = [];

after(async () => {
  for (const id of created) await db.delete(schema.guilds).where(eq(schema.guilds.id, id));
  await closeDb();
  await closeCache();
});

/** Captures the text content the log channel would receive. */
function logChannel(id = LOG) {
  const sent: string[] = [];
  const channel = {
    id,
    isSendable: () => true,
    send: async (payload: any) => {
      sent.push(payload.content ?? '');
      return {};
    },
  };
  return { sent, channel };
}

async function guildWith(
  settings: Record<string, unknown>,
  locale = 'en-US',
  channel: any = null,
  audit = false,
) {
  const id = uniqueGuildId();
  created.push(id);
  await updateGuildSettings(id, locale, settings);
  return {
    id,
    preferredLocale: locale,
    memberCount: 10,
    // Without View Audit Log the module skips attribution; `audit` grants it so simulated entries show.
    members: {
      me: { permissions: new PermissionsBitField(audit ? [PermissionFlagsBits.ViewAuditLog] : []) },
    },
    client: { user: { id: 'bot00000000000001' } },
    channels: { fetch: async (cid: string) => (channel && cid === channel.id ? channel : null) },
    // The real audit log is empty in tests; simulated entries are what attribution reads.
    fetchAuditLogs: async () => null,
  } as any;
}

function deletedMessage(guild: any, over: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    guild,
    channelId: 'c1',
    author: { id: 'u1', bot: false },
    system: false,
    content: 'secret plans',
    partial: false,
    attachments: new Collection(),
    stickers: new Collection(),
    reference: null,
    createdTimestamp: 0,
    ...over,
  } as any;
}

test('a deleted message is logged only when a channel is configured', async () => {
  const idle = logChannel();
  const unset = await guildWith({ serverLogChannelId: null }, 'en-US', idle.channel);
  await service.messageDeleted(deletedMessage(unset));
  assert.equal(idle.sent.length, 0);

  const { sent, channel: ch } = logChannel();
  const guild = await guildWith({ serverLogChannelId: LOG }, 'en-US', ch);
  await service.messageDeleted(deletedMessage(guild));
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes('<@u1>'), 'names the author');
  assert.ok(sent[0]?.includes('secret plans'), 'quotes the deleted text');
});

test('bots, system messages, ignored channels, the log channel itself and disabled events are skipped', async () => {
  const bot = logChannel();
  const gBot = await guildWith({ serverLogChannelId: LOG }, 'en-US', bot.channel);
  await service.messageDeleted(deletedMessage(gBot, { author: { id: 'b', bot: true } }));
  assert.equal(bot.sent.length, 0, 'bot author');

  const sys = logChannel();
  const gSys = await guildWith({ serverLogChannelId: LOG }, 'en-US', sys.channel);
  await service.messageDeleted(deletedMessage(gSys, { system: true }));
  assert.equal(sys.sent.length, 0, 'system message');

  const ign = logChannel();
  const gIgn = await guildWith(
    { serverLogChannelId: LOG, serverLogIgnoredChannels: ['c1'] },
    'en-US',
    ign.channel,
  );
  await service.messageDeleted(deletedMessage(gIgn));
  assert.equal(ign.sent.length, 0, 'ignored channel');

  const loop = logChannel();
  const gLoop = await guildWith({ serverLogChannelId: LOG }, 'en-US', loop.channel);
  await service.messageDeleted(deletedMessage(gLoop, { channelId: LOG }));
  assert.equal(loop.sent.length, 0, 'the log channel itself (no feedback loop)');

  const off = logChannel();
  const gOff = await guildWith(
    { serverLogChannelId: LOG, serverLogDisabledEvents: ['messageDelete'] },
    'en-US',
    off.channel,
  );
  await service.messageDeleted(deletedMessage(gOff));
  assert.equal(off.sent.length, 0, 'event turned off with the toggle');
});

test('an edit is logged only when the text actually changed, carrying both versions', async () => {
  const { sent, channel } = logChannel();
  const guild = await guildWith({ serverLogChannelId: LOG }, 'en-US', channel);
  const base = {
    partial: false,
    inGuild: () => true,
    guild,
    channelId: 'c1',
    url: 'https://d/x',
    author: { id: 'u1', bot: false },
    system: false,
    attachments: new Collection(),
  };
  await service.messageEdited(
    { partial: false, content: 'same', attachments: new Collection() } as any,
    { ...base, content: 'same' } as any,
  );
  assert.equal(sent.length, 0, 'unchanged text is not logged');
  await service.messageEdited(
    { partial: false, content: 'old words', attachments: new Collection() } as any,
    { ...base, content: 'new words' } as any,
  );
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes('old words') && sent[0]?.includes('new words'));
});

test('a bulk delete posts one line for the channel', async () => {
  const { sent, channel } = logChannel();
  const guild = await guildWith({ serverLogChannelId: LOG }, 'en-US', channel);
  const messages = new Collection<string, any>(
    ['1', '2', '3'].map((n) => [
      n,
      {
        id: n,
        author: { id: `u${n}`, username: `u${n}`, bot: false },
        content: `m${n}`,
        createdTimestamp: Date.now(),
        embeds: [],
        attachments: new Collection(),
      },
    ]),
  );
  await service.messagesBulkDeleted(guild, 'cbulk', messages, null);
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes('<#cbulk>'), 'names the channel the purge happened in');
});

test('a member join is logged with the member', async () => {
  const { sent, channel } = logChannel();
  const guild = await guildWith({ serverLogChannelId: LOG }, 'en-US', channel);
  await service.memberJoined({
    id: 'u9',
    guild,
    user: { id: 'u9', username: 'newbie', bot: false, createdTimestamp: Date.now() - 86_400_000 },
  } as any);
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes('<@u9>'), 'names the member who joined');
});

test('a member update is logged for a real change and skipped for a no-op', async () => {
  const role = (id: string) => ({ id, toString: () => `<@&${id}>` });
  const { sent, channel } = logChannel();
  const guild = await guildWith({ serverLogChannelId: LOG }, 'en-US', channel);
  const common = {
    partial: false,
    premiumSinceTimestamp: null,
    communicationDisabledUntilTimestamp: null,
    user: { id: 'm1' },
    id: 'm1',
    guild,
  };
  const before = {
    ...common,
    nickname: 'Old',
    roles: { cache: new Collection([['r1', role('r1')]]) },
  };
  const afterChanged = {
    ...common,
    nickname: 'New',
    roles: {
      cache: new Collection([
        ['r1', role('r1')],
        ['r2', role('r2')],
      ]),
    },
  };
  await service.memberUpdated(before as any, afterChanged as any);
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes('<@&r2>'), 'names the added role');

  const noop = logChannel();
  const g2 = await guildWith({ serverLogChannelId: LOG }, 'en-US', noop.channel);
  const same = {
    ...common,
    nickname: 'Same',
    guild: g2,
    roles: { cache: new Collection([['r1', role('r1')]]) },
  };
  await service.memberUpdated({ ...same } as any, { ...same } as any);
  assert.equal(noop.sent.length, 0, 'nothing tracked changed');
});

test('a ban is attributed to the moderator the audit log names', async () => {
  const { sent, channel } = logChannel();
  const guild = await guildWith({ serverLogChannelId: LOG }, 'en-US', channel, true);
  // Pretend Discord wrote an audit entry crediting mod000...1 with the ban (no second account needed).
  inject(AuditService).simulate(guild.id, {
    action: AuditLogEvent.MemberBanAdd,
    targetId: 'b1',
    executorId: 'mod00000000000001',
  });
  await service.memberBanned({ guild, user: { id: 'b1', username: 'bad', bot: false } } as any);
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes('<@b1>'), 'names the banned user');
  assert.ok(sent[0]?.includes('<@mod00000000000001>'), 'credits the moderator from the audit log');
});

test('joining and leaving a voice channel are logged', async () => {
  const join = logChannel();
  const gJoin = await guildWith({ serverLogChannelId: LOG }, 'en-US', join.channel);
  const member = { id: 'u1', user: { id: 'u1', bot: false }, guild: gJoin };
  await service.voiceStateUpdated(
    { channelId: null, member, serverMute: null, serverDeaf: null } as any,
    { channelId: 'v1', member, serverMute: null, serverDeaf: null } as any,
  );
  assert.equal(join.sent.length, 1);
  assert.ok(
    join.sent[0]?.includes('<@u1>') && join.sent[0]?.includes('<#v1>'),
    'names member and channel',
  );

  const leave = logChannel();
  const gLeave = await guildWith({ serverLogChannelId: LOG }, 'en-US', leave.channel);
  const m2 = { id: 'u1', user: { id: 'u1', bot: false }, guild: gLeave };
  await service.voiceStateUpdated(
    { channelId: 'v1', member: m2, serverMute: null, serverDeaf: null } as any,
    { channelId: null, member: m2, serverMute: null, serverDeaf: null } as any,
  );
  assert.equal(leave.sent.length, 1);
  assert.ok(leave.sent[0]?.includes('<@u1>'), 'names the member who left');

  const bot = logChannel();
  const gBot = await guildWith({ serverLogChannelId: LOG }, 'en-US', bot.channel);
  const music = { id: 'b2', user: { id: 'b2', bot: true }, guild: gBot };
  await service.voiceStateUpdated(
    { channelId: null, member: music, serverMute: null, serverDeaf: null } as any,
    { channelId: 'v1', member: music, serverMute: null, serverDeaf: null } as any,
  );
  assert.equal(bot.sent.length, 0, 'bots joining voice are not logged');
});

test('a role permission change is logged with the permissions that moved', async () => {
  const { sent, channel } = logChannel();
  const guild = await guildWith({ serverLogChannelId: LOG }, 'en-US', channel);
  const base = {
    guild,
    id: 'r1',
    name: 'Staff',
    color: 0,
    hoist: false,
    mentionable: false,
    toString: () => '<@&r1>',
  };
  await service.roleUpdated(
    { ...base, permissions: new PermissionsBitField([PermissionFlagsBits.KickMembers]) } as any,
    { ...base, permissions: new PermissionsBitField([PermissionFlagsBits.BanMembers]) } as any,
  );
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes('BanMembers'), 'names the added permission');
  assert.ok(sent[0]?.includes('KickMembers'), 'names the removed permission');
});

test('a channel permission-overwrite change is logged', async () => {
  const { sent, channel } = logChannel();
  const guild = await guildWith({ serverLogChannelId: LOG }, 'en-US', channel);
  const overwrite = (allow: bigint[]) => ({
    id: 'r1',
    type: OverwriteType.Role,
    allow: new PermissionsBitField(allow),
    deny: new PermissionsBitField([]),
  });
  const base = { guild, id: 'c1', name: 'geral', parentId: null, toString: () => '<#c1>' };
  await service.channelUpdated(
    { ...base, permissionOverwrites: { cache: new Collection([['r1', overwrite([])]]) } } as any,
    {
      ...base,
      permissionOverwrites: {
        cache: new Collection([['r1', overwrite([PermissionFlagsBits.SendMessages])]]),
      },
    } as any,
  );
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes('SendMessages'), 'names the permission whose overwrite changed');
});

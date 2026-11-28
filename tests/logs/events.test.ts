import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Collection, PermissionsBitField } from 'discord.js';
import { eq } from 'drizzle-orm';
import '@/app.module';
import { closeCache } from '@/cache';
import { closeDb, db, schema, updateGuildSettings } from '@/db';
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

async function guildWith(settings: Record<string, unknown>, locale = 'en-US', channel: any = null) {
  const id = uniqueGuildId();
  created.push(id);
  await updateGuildSettings(id, locale, settings);
  return {
    id,
    preferredLocale: locale,
    memberCount: 10,
    // A `me` member without View Audit Log means the module skips audit-log attribution cleanly.
    members: { me: { permissions: new PermissionsBitField([]) } },
    client: { user: { id: 'bot00000000000001' } },
    channels: { fetch: async (cid: string) => (channel && cid === channel.id ? channel : null) },
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
  const unset = await guildWith({ serverLogChannelId: null });
  const { sent: s0, channel } = logChannel();
  void channel;
  await service.messageDeleted(deletedMessage(unset));
  assert.equal(s0.length, 0);

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
  const gIgn = await guildWith({ serverLogChannelId: LOG, serverLogIgnoredChannels: ['c1'] }, 'en-US', ign.channel);
  await service.messageDeleted(deletedMessage(gIgn));
  assert.equal(ign.sent.length, 0, 'ignored channel');

  const loop = logChannel();
  const gLoop = await guildWith({ serverLogChannelId: LOG }, 'en-US', loop.channel);
  await service.messageDeleted(deletedMessage(gLoop, { channelId: LOG }));
  assert.equal(loop.sent.length, 0, 'the log channel itself (no feedback loop)');

  const off = logChannel();
  const gOff = await guildWith({ serverLogChannelId: LOG, serverLogDisabledEvents: ['messageDelete'] }, 'en-US', off.channel);
  await service.messageDeleted(deletedMessage(gOff));
  assert.equal(off.sent.length, 0, 'event turned off with the toggle');
});

test('an edit is logged only when the text actually changed, carrying both versions', async () => {
  const { sent, channel } = logChannel();
  const guild = await guildWith({ serverLogChannelId: LOG }, 'en-US', channel);
  const base = { partial: false, inGuild: () => true, guild, channelId: 'c1', url: 'https://d/x', author: { id: 'u1', bot: false }, system: false, attachments: new Collection() };
  await service.messageEdited({ partial: false, content: 'same', attachments: new Collection() } as any, { ...base, content: 'same' } as any);
  assert.equal(sent.length, 0, 'unchanged text is not logged');
  await service.messageEdited({ partial: false, content: 'old words', attachments: new Collection() } as any, { ...base, content: 'new words' } as any);
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes('old words') && sent[0]?.includes('new words'));
});

test('a bulk delete posts one line for the channel', async () => {
  const { sent, channel } = logChannel();
  const guild = await guildWith({ serverLogChannelId: LOG }, 'en-US', channel);
  const messages = new Collection<string, any>(
    ['1', '2', '3'].map((n) => [n, { id: n, author: { id: `u${n}`, username: `u${n}`, bot: false }, content: `m${n}`, createdTimestamp: Date.now(), embeds: [], attachments: new Collection() }]),
  );
  await service.messagesBulkDeleted(guild, 'cbulk', messages, null);
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes('<#cbulk>'), 'names the channel the purge happened in');
});

test('a member join is logged with the member', async () => {
  const { sent, channel } = logChannel();
  const guild = await guildWith({ serverLogChannelId: LOG }, 'en-US', channel);
  await service.memberJoined({ id: 'u9', guild, user: { id: 'u9', username: 'newbie', bot: false, createdTimestamp: Date.now() - 86_400_000 } } as any);
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes('<@u9>'), 'names the member who joined');
});

test('a member update is logged for a real change and skipped for a no-op', async () => {
  const role = (id: string) => ({ id, toString: () => `<@&${id}>` });
  const { sent, channel } = logChannel();
  const guild = await guildWith({ serverLogChannelId: LOG }, 'en-US', channel);
  const common = { partial: false, premiumSinceTimestamp: null, communicationDisabledUntilTimestamp: null, user: { id: 'm1' }, id: 'm1', guild };
  const before = { ...common, nickname: 'Old', roles: { cache: new Collection([['r1', role('r1')]]) } };
  const afterChanged = { ...common, nickname: 'New', roles: { cache: new Collection([['r1', role('r1')], ['r2', role('r2')]]) } };
  await service.memberUpdated(before as any, afterChanged as any);
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes('<@&r2>'), 'names the added role');

  const noop = logChannel();
  const g2 = await guildWith({ serverLogChannelId: LOG }, 'en-US', noop.channel);
  const same = { ...common, nickname: 'Same', guild: g2, roles: { cache: new Collection([['r1', role('r1')]]) } };
  await service.memberUpdated({ ...same } as any, { ...same } as any);
  assert.equal(noop.sent.length, 0, 'nothing tracked changed');
});

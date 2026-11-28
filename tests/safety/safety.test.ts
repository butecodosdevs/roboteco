import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { Collection, PermissionFlagsBits } from 'discord.js';
import { eq } from 'drizzle-orm';
import '@/app.module';
import { cache, closeCache } from '@/cache';
import { config } from '@/config';
import { inject } from '@/core';
import { closeDb, db, schema, updateGuildSettings } from '@/db';
import { RecheckJob } from '@/modules/safety/jobs/recheck.job';
import { PhishingListService } from '@/modules/safety/phishing-list.service';
import { SafetyService } from '@/modules/safety/safety.service';
import { type ThreatCheck, ThreatsService } from '@/modules/safety/threats.service';
import { type FakeServer, fakeServer, uniqueGuildId } from '../plugins/fakes';

const run = Date.now().toString(36);
const evil = `evil-${run}.test`;
const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const logChannelId = '100000000000000400';
const chatChannelId = '100000000000000300';
const created: string[] = [];

// Attachments are downloaded from Discord's CDN; this serves them instead.
const files = createServer((request, response) =>
  response.end(request.url === '/eicar.com' ? eicar : 'a harmless text file'),
);
let filesUrl = '';

before(async () => {
  await new Promise<void>((resolve) => files.listen(0, '127.0.0.1', resolve));
  filesUrl = `http://127.0.0.1:${(files.address() as AddressInfo).port}`;
  inject(PhishingListService).load([
    JSON.stringify({ domains: [evil, 'vercel.app', `scam-${run}.vercel.app`] }),
  ]);
});

after(async () => {
  files.close();
  for (const guildId of created) {
    await db.delete(schema.moderationCases).where(eq(schema.moderationCases.guildId, guildId));
    await db.delete(schema.guilds).where(eq(schema.guilds.id, guildId));
  }
  await db.delete(schema.scheduledJobs).where(eq(schema.scheduledJobs.name, 'safety.recheck'));
  await closeDb();
  await closeCache();
});

interface Server extends FakeServer {
  deleted: { messageId: string; reason: string }[];
  messages: Map<string, any>;
}

/** A server with scanning on, a moderation log channel, and a chat channel whose messages can be fetched. */
async function server(settings: { safetyTimeoutMinutes?: number } = {}): Promise<Server> {
  const s = fakeServer() as Server;
  created.push(s.guild.id);
  s.deleted = [];
  s.messages = new Map();
  await updateGuildSettings(s.guild.id, 'en-US', {
    safetyEnabled: true,
    moderationLogChannelId: logChannelId,
    ...settings,
  });

  Object.assign(s.channel(logChannelId), { isSendable: () => true });
  Object.assign(s.channel(chatChannelId), {
    toString: () => `<#${chatChannelId}>`,
    messages: { fetch: async (id: string) => s.messages.get(id) ?? null },
  });
  s.guild.client.rest.delete = async (route: string, options: { reason: string }) => {
    s.deleted.push({ messageId: route.split('/').at(-1) ?? '', reason: options.reason });
  };
  s.guild.client.guilds = { cache: new Collection([[s.guild.id, s.guild]]) };
  return s;
}

function post(s: Server, author: any, content: string, attachments: string[] = []) {
  const message = {
    id: uniqueGuildId(),
    guildId: s.guild.id,
    channelId: chatChannelId,
    guild: s.guild,
    client: s.guild.client,
    channel: { toString: () => `<#${chatChannelId}>` },
    content,
    embeds: [],
    messageSnapshots: new Collection(),
    attachments: new Collection(
      attachments.map((name) => [name, { id: name, name, size: 100, url: `${filesUrl}/${name}` }]),
    ),
    webhookId: null,
    member: author,
    author: author.user,
    inGuild: () => true,
  };
  s.messages.set(message.id, message);
  return message as any;
}

const modLogPosts = (s: Server) => s.sent.filter((sent) => sent.channelId === logChannelId);

async function pendingRechecks(s: Server): Promise<string[]> {
  const entries = await cache.zrange('safety:rechecks', 0, -1);
  return entries.filter((entry) => entry.startsWith(`${s.guild.id}:`));
}

/** Makes every pending recheck of the server due, then runs the job as the runner would. */
async function runDueRechecks(s: Server): Promise<void> {
  for (const entry of await pendingRechecks(s)) await cache.zadd('safety:rechecks', 0, entry);
  await new RecheckJob().execute({}, s.guild.client);
}

test('a link on a listed domain is deleted and reported with the link defanged', async () => {
  const s = await server();
  const author = s.member('200000000000000100');
  const message = post(s, author, `free nitro https://login.${evil}/claim!`);

  await inject(SafetyService).process(message);

  assert.deepEqual(
    s.deleted.map((d) => d.messageId),
    [message.id],
  );
  const report = modLogPosts(s)[0]?.payload.embeds[0].data.description as string;
  assert.ok(report.includes(`hxxps://login[.]${evil.replace('.', '[.]')}/claim`));
  assert.ok(!report.includes(`https://login.${evil}`));
  assert.equal(s.timeouts.size, 0);
});

test('a whole shared platform on the list flags nothing, but a listed site on it is deleted', async () => {
  const s = await server();
  const author = s.member('200000000000000100');
  const portfolio = post(s, author, `https://portfolio-${run}.vercel.app/`);
  const scam = post(s, author, `https://scam-${run}.vercel.app/login`);

  await inject(SafetyService).process(portfolio);
  await inject(SafetyService).process(scam);

  assert.deepEqual(
    s.deleted.map((d) => d.messageId),
    [scam.id],
  );
});

test('a clean message stays up and is queued for its 1 h recheck', async () => {
  const s = await server();
  const message = post(s, s.member('200000000000000100'), `see https://clean-${run}.test/`);

  await inject(SafetyService).process(message);

  assert.equal(s.deleted.length, 0);
  const due = await cache.zscore(
    'safety:rechecks',
    `${s.guild.id}:${chatChannelId}:${message.id}:0`,
  );
  const hoursAway = (Number(due) - Date.now()) / 3_600_000;
  assert.ok(hoursAway > 0.9 && hoursAway <= 1, `due in ${hoursAway} h`);
});

test('with scanning off, a malicious link is neither deleted nor queued', async () => {
  const s = await server();
  await updateGuildSettings(s.guild.id, 'en-US', { safetyEnabled: false });
  const message = post(s, s.member('200000000000000100'), `https://${evil}/`);

  await inject(SafetyService).process(message);

  assert.equal(s.deleted.length, 0);
  assert.deepEqual(await pendingRechecks(s), []);
});

test('a create, an edit and a recheck racing on one message delete and report it once', async () => {
  const s = await server();
  const message = post(s, s.member('200000000000000100'), `https://${evil}/gift`);
  const safety = inject(SafetyService);

  await Promise.all([safety.process(message), safety.process(message), safety.process(message, 0)]);

  assert.equal(s.deleted.length, 1);
  assert.equal(modLogPosts(s).length, 1);
});

test('a configured timeout is applied and recorded as a case with its length', async () => {
  const s = await server({ safetyTimeoutMinutes: 15 });
  const author = s.member('200000000000000100');

  await inject(SafetyService).process(post(s, author, `https://${evil}/`));

  assert.equal(s.timeouts.get('200000000000000100'), 15 * 60_000);
  const [entry] = await db
    .select()
    .from(schema.moderationCases)
    .where(eq(schema.moderationCases.guildId, s.guild.id));
  assert.equal(entry?.action, 'timeout');
  assert.equal(entry?.targetId, '200000000000000100');
  assert.equal(entry?.durationSeconds, 15 * 60);
});

test('a member with Manage Server has the message deleted but is not timed out', async () => {
  const s = await server({ safetyTimeoutMinutes: 15 });
  s.role('300000000000000100', 10, [PermissionFlagsBits.ManageGuild]);
  const admin = s.member('200000000000000101', ['300000000000000100']);

  await inject(SafetyService).process(post(s, admin, `https://${evil}/`));

  assert.equal(s.deleted.length, 1);
  assert.equal(s.timeouts.size, 0);
});

test('rechecks: clean at 1 h queues the 24 h one, which deletes a link now known bad', async () => {
  const s = await server();
  const message = post(s, s.member('200000000000000100'), `https://later-${run}.test/`);
  await inject(SafetyService).process(message);

  await runDueRechecks(s);
  const next = await cache.zscore(
    'safety:rechecks',
    `${s.guild.id}:${chatChannelId}:${message.id}:1`,
  );
  const hoursAway = (Number(next) - Date.now()) / 3_600_000;
  assert.ok(hoursAway > 23.9 && hoursAway <= 24, `due in ${hoursAway} h`);
  assert.equal(s.deleted.length, 0);

  // The site was added to a list in the meantime.
  inject(PhishingListService).load([JSON.stringify([evil, `later-${run}.test`])]);
  await runDueRechecks(s);

  assert.deepEqual(
    s.deleted.map((d) => d.messageId),
    [message.id],
  );
  assert.deepEqual(await pendingRechecks(s), []);
  inject(PhishingListService).load([
    JSON.stringify({ domains: [evil, 'vercel.app', `scam-${run}.vercel.app`] }),
  ]);
});

test('the 24 h recheck is the last one: a message still clean is not queued again', async () => {
  const s = await server();
  const message = post(s, s.member('200000000000000100'), `https://fine-${run}.test/`);

  await inject(SafetyService).process(message, 1);

  assert.equal(s.deleted.length, 0);
  assert.deepEqual(await pendingRechecks(s), []);
});

test('an EICAR attachment is deleted by ClamAV; a harmless one stays', {
  skip: config.safety.clamav ? false : 'CLAMAV_HOST is not set',
}, async () => {
  const s = await server();
  const author = s.member('200000000000000100');
  const infected = post(s, author, 'homework', ['eicar.com']);
  const harmless = post(s, author, 'notes', ['notes.txt']);

  await inject(SafetyService).process(infected);
  await inject(SafetyService).process(harmless);

  assert.deepEqual(
    s.deleted.map((d) => d.messageId),
    [infected.id],
  );
});

/** A check that records how often it was asked, and answers with `answer`. */
function check(answer: () => Promise<string | null>): ThreatCheck<string> & { calls: number } {
  const counted = {
    source: 'safeBrowsing' as const,
    enabled: true,
    calls: 0,
    confirm: async () => {
      counted.calls++;
      return answer();
    },
  };
  return counted;
}

test('a check that cannot answer gives an unknown verdict, which is not remembered', async () => {
  const threats = inject(ThreatsService);
  const failing = check(async () => {
    throw new Error('HTTP 503');
  });
  const id = `url:https://flaky-${run}.test/`;

  assert.equal(await threats.verdict(id, 'x', [failing], false), 'unknown');
  assert.equal(await threats.verdict(id, 'x', [failing], false), 'unknown');
  assert.equal(failing.calls, 2);
});

test('a remembered clean verdict is reused, except by a recheck; a threat always stands', async () => {
  const threats = inject(ThreatsService);
  const clean = check(async () => null);
  const cleanId = `url:https://remembered-${run}.test/`;

  assert.equal(await threats.verdict(cleanId, 'x', [clean], false), 'clean');
  assert.equal(await threats.verdict(cleanId, 'x', [clean], false), 'clean');
  assert.equal(clean.calls, 1);
  await threats.verdict(cleanId, 'x', [clean], true);
  assert.equal(clean.calls, 2);

  const bad = check(async () => 'MALWARE');
  const badId = `url:https://remembered-bad-${run}.test/`;
  await threats.verdict(badId, 'x', [bad], false);
  assert.deepEqual(await threats.verdict(badId, 'x', [bad], true), {
    source: 'safeBrowsing',
    detail: 'MALWARE',
  });
  assert.equal(bad.calls, 1);
});

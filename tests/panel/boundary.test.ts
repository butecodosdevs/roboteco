import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { after, before, test } from 'node:test';
import { Client, Collection, GatewayIntentBits } from 'discord.js';

process.env.DATABASE_URL ??= 'postgres://roboteco:roboteco@localhost:5432/roboteco';
process.env.S3_ENDPOINT ??= 'http://localhost:3900';
process.env.S3_ACCESS_KEY_ID ??= 'x';
process.env.S3_SECRET_ACCESS_KEY ??= 'x';
process.env.S3_BUCKET ??= 'roboteco';
process.env.DISCORD_TOKEN ??= 'x';
process.env.DISCORD_CLIENT_ID ??= 'x';
process.env.PANEL_TOKEN ??= 'panel-check-token-123456';
process.env.PANEL_SECRET ??= 'panel-check-secret-0123456789abcdef';
process.env.PANEL_URL = 'http://127.0.0.1:4399';
process.env.PANEL_ALLOWED_EMAILS ??= 'eu@exemplo.com';
process.env.DISCORD_CLIENT_SECRET ??= 'check-client-secret';
// Never touch the real panel/settings.json: this check edits the allowlist on purpose.
process.env.ROBOTECO_SETTINGS_PATH = `${tmpdir()}/roboteco-panel-check-${process.pid}.json`;

const { inject, panelGateway } = await import('@/core');
const { startHttpServer } = await import('@/core/http');
const { PanelModule } = await import('@/modules/panel/panel.module');
const { PanelTogglesService } = await import('@/modules/panel/panel-toggles.service');
const { liveSetting, writeSettings } = await import('@/core/settings');
const { authSchema, closeDb, db } = await import('@/db');
const { eq } = await import('drizzle-orm');

const token = process.env.PANEL_TOKEN;
const auth = { 'x-panel-token': token ?? '' };
const base = 'http://127.0.0.1:4399';

// One server for the whole file: the gateway, sessions and toggles are the real ones.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
// Two servers the bot "is in", so the guild guard has something to accept and something to refuse.
const guildA = '100000000000000001';
const guildB = '100000000000000002';
for (const [id, name] of [
  [guildA, 'Alpha'],
  [guildB, 'Beta'],
] as const) {
  (client.guilds.cache as Collection<string, unknown>).set(id, {
    id,
    name,
    memberCount: 1,
    iconURL: () => null,
    members: { cache: new Collection() },
  });
}
let server: ReturnType<typeof startHttpServer>;

before(async () => {
  // The real module: its constructor registers the gateway, the session gate and the routes. No
  // module graph is needed here — the panel is the only feature this file exercises.
  new PanelModule();
  // The catalog is what `bootstrap` hands over; only the grouping endpoint reads it.
  panelGateway()?.describe({
    catalog: [
      { name: 'ban', description: 'Bans a member' },
      { name: 'rank', description: 'Shows the rank' },
    ],
    builtIn: ['ban', 'rank'],
    owners: { ban: 'ModerationModule', rank: 'LevelsModule' },
  });
  server = startHttpServer(client, 4399);
});

after(async () => {
  server.close();
  await client.destroy();
  rmSync(process.env.ROBOTECO_SETTINGS_PATH ?? '', { force: true });
  await closeDb();
});

const forge = (sessionToken: string) =>
  `better-auth.session_token=${encodeURIComponent(
    `${sessionToken}.${createHmac('sha256', process.env.PANEL_SECRET ?? '')
      .update(sessionToken)
      .digest('base64')}`,
  )}`;

const session = async (id: string, email: string, verified = true) => {
  await db
    .insert(authSchema.authUsers)
    .values({ id: `u_${id}`, name: id, email, emailVerified: verified })
    .onConflictDoNothing();
  await db
    .insert(authSchema.authSessions)
    .values({
      id: `s_${id}`,
      token: `check-session-${id}-0123456789`,
      userId: `u_${id}`,
      expiresAt: new Date(Date.now() + 3_600_000),
    })
    .onConflictDoNothing();
  return forge(`check-session-${id}-0123456789`);
};

test('health answers before the gateway connects', async () => {
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 503);
  const body = (await health.json()) as Record<string, unknown>;
  assert.equal(body.status, 'starting');
  assert.equal(body.cache, 'unavailable');
  assert.ok(body.ping === null || typeof body.ping === 'number');
});

test('the panel html is public and the session gate refuses without one', async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes('roboteco'));

  const status = await fetch(`${base}/api/panel/auth/status`);
  assert.equal(status.status, 200);
  const statusBody = (await status.json()) as { authenticated: boolean; discord: boolean };
  assert.equal(statusBody.authenticated, false);
  assert.equal(statusBody.discord, true);

  assert.equal((await fetch(`${base}/api/panel/guilds`)).status, 401, 'no token → 401');
  assert.equal(
    (await fetch(`${base}/api/panel/guilds`, { headers: auth })).status,
    200,
    'header token works for scripts',
  );
  assert.equal(
    (await fetch(`${base}/api/panel/guilds?token=${token}`)).status,
    401,
    'a token in the query string is ignored on purpose',
  );
});

test('a guild the bot is not in is refused', async () => {
  // The review reproduced this: the guild came from the query string and was used unchecked, so
  // any panel user could read another server's cases and their private reason.
  for (const path of ['/api/panel', '/api/panel/commands', '/api/panel/usage']) {
    assert.equal(
      (await fetch(`${base}${path}?guild=999999999999999999`, { headers: auth })).status,
      404,
      `${path} refuses a guild the bot is not in`,
    );
  }
  assert.equal(
    (await fetch(`${base}/api/panel/plugins?guild=999999999999999999`, { headers: auth })).status,
    404,
    'the plugin route refuses it too',
  );
});

test('a missing guild is a 400, not a guess', async () => {
  const empty = new Client({ intents: [GatewayIntentBits.Guilds] });
  const bare = startHttpServer(empty, 4398);
  try {
    assert.equal(
      (await fetch('http://127.0.0.1:4398/api/panel', { headers: auth })).status,
      400,
      'no servers → 400 instead of reading an undefined id',
    );
  } finally {
    bare.close();
    await empty.destroy();
  }
});

test('a disabled command never reaches the handler', async () => {
  // `PUT /commands` with an unknown name is a 400, so a typo cannot silently disable nothing.
  assert.equal(
    (
      await fetch(`${base}/api/panel/commands?guild=${guildA}`, {
        method: 'PUT',
        headers: { ...auth, 'content-type': 'application/json' },
        body: '{"commands":["nao-existe"],"enabled":false}',
      })
    ).status,
    400,
  );
  const toggles = inject(PanelTogglesService);
  assert.deepEqual(toggles.disabled(), [], 'the refusal wrote nothing');
  assert.equal(toggles.isDisabled('nao-existe'), false);
});

test('saving the allowlist takes effect on the next request', async () => {
  writeSettings({ PANEL_ALLOWED_EMAILS: 'eu@exemplo.com' });
  const inside = await session('inside', 'EU@EXEMPLO.COM');
  assert.equal(
    (await fetch(`${base}/api/panel/guilds`, { headers: { cookie: inside } })).status,
    200,
    'a session matches the allowlist regardless of case',
  );

  const outside = await session('outside', 'intruso@exemplo.com');
  assert.equal(
    (await fetch(`${base}/api/panel/guilds`, { headers: { cookie: outside } })).status,
    401,
    'an e-mail outside the allowlist is refused',
  );

  const list = (await (
    await fetch(`${base}/api/panel/auth/access`, { headers: { cookie: inside } })
  ).json()) as { emails: string[] };
  assert.deepEqual(list.emails, ['eu@exemplo.com']);

  const put = await fetch(`${base}/api/panel/auth/access`, {
    method: 'PUT',
    headers: { cookie: inside, 'content-type': 'application/json' },
    body: '{"emails":["EU@Exemplo.com","Novo@Exemplo.com","eu@exemplo.com"]}',
  });
  assert.equal(put.status, 200);
  assert.deepEqual(((await put.json()) as { emails: string[] }).emails, [
    'eu@exemplo.com',
    'novo@exemplo.com',
  ]);

  assert.equal(
    (
      await fetch(`${base}/api/panel/auth/access`, {
        method: 'PUT',
        headers: { cookie: inside, 'content-type': 'application/json' },
        body: '{"emails":[]}',
      })
    ).status,
    400,
    'an empty allowlist is refused, or the panel locks itself out',
  );
  assert.equal(
    (
      await fetch(`${base}/api/panel/auth/access`, {
        method: 'PUT',
        headers: { cookie: inside, 'content-type': 'application/json' },
        body: '{"emails":["nao-e-email"]}',
      })
    ).status,
    400,
    'a malformed e-mail is refused',
  );

  assert.equal(liveSetting('PANEL_ALLOWED_EMAILS'), 'eu@exemplo.com,novo@exemplo.com');
  writeSettings({ PANEL_ALLOWED_EMAILS: 'eu@exemplo.com' });
  assert.equal(
    (await fetch(`${base}/api/panel/guilds`, { headers: { cookie: inside } })).status,
    200,
    'the remaining e-mail still gets in',
  );
  assert.equal(
    (await fetch(`${base}/api/panel/guilds`, { headers: { cookie: outside } })).status,
    401,
    'removing an e-mail refuses its live session at once',
  );
  writeSettings({ PANEL_ALLOWED_EMAILS: '' });

  await db.delete(authSchema.authSessions).where(eq(authSchema.authSessions.userId, 'u_inside'));
  await db.delete(authSchema.authSessions).where(eq(authSchema.authSessions.userId, 'u_outside'));
  await db.delete(authSchema.authUsers).where(eq(authSchema.authUsers.id, 'u_inside'));
  await db.delete(authSchema.authUsers).where(eq(authSchema.authUsers.id, 'u_outside'));
});

test('an unverified e-mail is refused even when the address is allowlisted', async () => {
  // Discord stores the `verified` flag on the user, and the account still gets created. Without
  // the check, typing an allowlisted address into an unverified account was enough to get a
  // session for a mailbox the person does not own — the allowlist would be self-asserted.
  writeSettings({ PANEL_ALLOWED_EMAILS: 'eu@exemplo.com' });
  const unverified = await session('unverified', 'eu@exemplo.com', false);
  assert.equal(
    (await fetch(`${base}/api/panel/guilds`, { headers: { cookie: unverified } })).status,
    401,
  );
  await db
    .delete(authSchema.authSessions)
    .where(eq(authSchema.authSessions.userId, 'u_unverified'));
  await db.delete(authSchema.authUsers).where(eq(authSchema.authUsers.id, 'u_unverified'));
  writeSettings({ PANEL_ALLOWED_EMAILS: 'eu@exemplo.com' });
});

test('the panel cannot replace the bot token or the Sentry DSN', async () => {
  // The review reproduced `PUT /settings {"DISCORD_TOKEN": "…"}` returning 200 and writing both to
  // panel/settings.json; a restart then ran the bot on someone else's token.
  for (const key of ['DISCORD_TOKEN', 'SENTRY_DSN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID']) {
    const res = await fetch(`${base}/api/panel/settings`, {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ [key]: 'hijacked' }),
    });
    assert.equal(res.status, 400, `${key} is read-only`);
  }
  const fields = (await (await fetch(`${base}/api/panel/settings`, { headers: auth })).json()) as {
    fields: { key: string; writable: boolean }[];
  };
  assert.equal(
    fields.fields.find((field) => field.key === 'DISCORD_TOKEN')?.writable,
    false,
    'the panel is told it is read-only, so it can render it disabled',
  );
  assert.equal(fields.fields.find((field) => field.key === 'LOG_LEVEL')?.writable, true);

  const refusal = await fetch(`${base}/api/panel/settings`, {
    method: 'PUT',
    headers: { ...auth, 'content-type': 'application/json' },
    body: '{"DISCORD_TOKEN":"hijacked"}',
  });
  assert.match(
    ((await refusal.json()) as { error: string }).error,
    /^read_only_setting: DISCORD_TOKEN$/,
    'the refusal names the code and the key, so the browser can translate one and show the other',
  );

  const ok = await fetch(`${base}/api/panel/settings`, {
    method: 'PUT',
    headers: { ...auth, 'content-type': 'application/json' },
    body: '{"LOG_LEVEL":"debug"}',
  });
  assert.equal(ok.status, 200, 'a writable knob still saves');
});

test('the panel cannot grant plugin permissions or hosts', async () => {
  // A granted permission is the security boundary for a plugin, so it lives in the reviewed
  // registry. A typo saved from the browser used to leave the plugin unloaded.
  for (const body of [
    '{"permissions":["kv","moderation.act","http"]}',
    '{"allowedHosts":["other.example"]}',
    '{"enabled":true,"permissions":["kv"]}',
  ]) {
    const res = await fetch(`${base}/api/panel/plugins/hello?guild=${guildA}`, {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json' },
      body,
    });
    assert.ok(res.status === 400 || res.status === 404, `refused: ${body}`);
  }
});

test('the password route is gone and Discord is the only provider', async () => {
  assert.equal(
    (await fetch(`${base}/api/panel/auth/login`, { method: 'POST', body: '{"password":"x"}' }))
      .status,
    405,
  );
  const social = await fetch(`${base}/api/auth/sign-in/social`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"provider":"discord","callbackURL":"http://127.0.0.1:4399/","disableRedirect":true}',
  });
  assert.equal(social.status, 200);
  const socialBody = (await social.json()) as { url?: string };
  assert.ok(socialBody.url?.startsWith('https://discord.com/api/oauth2/authorize'));
  assert.ok(socialBody.url?.includes('scope=identify+email'));
});

test('static files are limited to the web folder', async () => {
  assert.equal((await fetch(`${base}/../package.json`)).status, 404, 'no path traversal');
  assert.equal((await fetch(`${base}/server.js`)).status, 404, 'only known extensions');
});

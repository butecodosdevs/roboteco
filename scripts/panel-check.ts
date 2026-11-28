// Run with: pnpm panel:check
// Asserts the HTTP boundary: health, session gate, the public auth segment, static files.
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Client, GatewayIntentBits } from 'discord.js';

process.env.DATABASE_URL ??= 'postgres://roboteco:roboteco@localhost:5432/roboteco';
process.env.S3_ENDPOINT ??= 'http://localhost:3900';
process.env.S3_ACCESS_KEY_ID ??= 'x';
process.env.S3_SECRET_ACCESS_KEY ??= 'x';
process.env.S3_BUCKET ??= 'roboteco';
process.env.DISCORD_TOKEN ??= 'x';
process.env.DISCORD_CLIENT_ID ??= 'x';
process.env.PANEL_TOKEN ??= 'panel-check-token-123456';
process.env.PANEL_URL = 'http://127.0.0.1:4399';
process.env.PANEL_SECRET ??= 'panel-check-secret-0123456789abcdef';
process.env.PANEL_ALLOWED_EMAILS ??= 'eu@exemplo.com';
process.env.DISCORD_CLIENT_SECRET ??= 'check-client-secret';
// Never touch the real panel/settings.json: this check edits the allowlist on purpose.
process.env.ROBOTECO_SETTINGS_PATH = `${tmpdir()}/roboteco-panel-check-${process.pid}.json`;

const { startHttpServer } = await import('@/core/http');
const { inject, registerCommandCatalog, registerCommandOwners } = await import('@/core');
const { PanelAuthService } = await import('@/modules/panel/panel-auth.service');
const { registerPanelSettings } = await import('@/modules/panel/panel-settings.service');
const { liveSetting, writeSettings } = await import('@/core/settings');

// Only what the grouping endpoint reads: the catalog plus who owns each built-in.
registerCommandCatalog([
  { name: 'ban', description: 'Bane um usuário' },
  { name: 'kick', description: 'Expulsa um membro' },
  { name: 'rank', description: 'Mostra o rank' },
]);
registerCommandOwners({ ban: 'ModerationModule', kick: 'ModerationModule', rank: 'LevelsModule' });

// Same wiring PanelModule does on ready, so the gate is the real one.
const token = process.env.PANEL_TOKEN;
await inject(PanelAuthService).start();
registerPanelSettings();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const server = startHttpServer(client, 4399, { panelToken: token });
const base = 'http://127.0.0.1:4399';
const auth = { 'x-panel-token': token };

const health = await fetch(`${base}/health`);
assert.equal(health.status, 503, 'not connected yet → 503');
const body = (await health.json()) as Record<string, unknown>;
assert.equal(body.status, 'starting');
assert.equal(body.cache, 'unavailable');
assert.ok(body.ping === null || typeof body.ping === 'number', 'ping is a number or null');

assert.equal((await fetch(`${base}/`)).status, 200, 'panel html is public');
assert.equal(await (await fetch(`${base}/`)).text().then((t) => t.includes('roboteco')), true);

// The login screen has to answer before anyone is authenticated, which is what makes it usable.
const status = await fetch(`${base}/api/panel/auth/status`);
assert.equal(status.status, 200, 'auth status is public');
const statusBody = (await status.json()) as { authenticated: boolean; discord: boolean };
assert.equal(statusBody.authenticated, false, 'no cookie → not authenticated');
assert.equal(statusBody.discord, true, 'the client id and secret make Discord sign-in ready');

assert.equal((await fetch(`${base}/api/panel/guilds`)).status, 401, 'no token → 401');
assert.equal(
  (await fetch(`${base}/api/panel/guilds`, { headers: auth })).status,
  200,
  'header token still works for scripts',
);
assert.equal(
  (await fetch(`${base}/api/panel/guilds?token=${token}`)).status,
  401,
  'query string token is ignored on purpose',
);
assert.equal((await fetch(`${base}/api/panel`, { headers: auth })).status, 400, 'no guild → 400');
assert.equal(
  (await fetch(`${base}/api/panel/commands`)).status,
  401,
  'built-in commands need a session',
);
const commands = (await (await fetch(`${base}/api/panel/commands`, { headers: auth })).json()) as {
  modules: { module: string; commands: { name: string; code: string }[] }[];
  disabled: string[];
};
assert.ok(commands.modules.length > 0, 'built-in commands are grouped by module');
assert.ok(
  commands.modules.every((m) => m.commands.length > 0 && m.commands.every((c) => c.name && c.code)),
  'every group has named commands',
);
assert.ok(Array.isArray(commands.disabled), 'the toggle list is always present');
assert.equal(
  (
    await fetch(`${base}/api/panel/commands`, {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json' },
      body: '{"commands":["nao-existe"],"enabled":false}',
    })
  ).status,
  400,
  'an unknown command is refused instead of written to the toggle file',
);
const disabled = (await (
  await fetch(`${base}/api/panel/commands`, {
    method: 'PUT',
    headers: { ...auth, 'content-type': 'application/json' },
    body: '{"commands":["rank"],"enabled":false}',
  })
).json()) as { disabled: string[] };
assert.deepEqual(disabled.disabled, ['rank'], 'disabling a command is persisted');
const restored = (await (
  await fetch(`${base}/api/panel/commands`, {
    method: 'PUT',
    headers: { ...auth, 'content-type': 'application/json' },
    body: '{"commands":["rank"],"enabled":true}',
  })
).json()) as { disabled: string[] };
assert.deepEqual(restored.disabled, [], 'enabling it again clears the toggle');
assert.equal((await fetch(`${base}/api/panel/settings`)).status, 401, 'settings needs a session');
assert.equal((await fetch(`${base}/api/panel/settings`, { headers: auth })).status, 200);
// No password path exists any more: the only way in is the Discord redirect.
assert.equal(
  (await fetch(`${base}/api/panel/auth/login`, { method: 'POST', body: '{"password":"x"}' }))
    .status,
  405,
  'the password route is gone',
);
const social = await fetch(`${base}/api/auth/sign-in/social`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{"provider":"discord","callbackURL":"http://127.0.0.1:4399/","disableRedirect":true}',
});
assert.equal(social.status, 200, 'better-auth answers on /api/auth');
const socialBody = (await social.json()) as { url?: string };
assert.ok(
  socialBody.url?.startsWith('https://discord.com/api/oauth2/authorize'),
  'sign-in hands back the Discord redirect url',
);
assert.ok(
  socialBody.url?.includes('scope=identify+email'),
  'the email scope is what the allowlist matches on',
);
// The allowlist is enforced on every request, so removing an email also kills its live session.
const { createHmac } = await import('node:crypto');
const { authSchema, db } = await import('@/db');
const { eq } = await import('drizzle-orm');
const forge = (token: string) =>
  `better-auth.session_token=${encodeURIComponent(
    `${token}.${createHmac('sha256', process.env.PANEL_SECRET ?? '')
      .update(token)
      .digest('base64')}`,
  )}`;
const session = async (id: string, email: string) => {
  await db
    .insert(authSchema.authUsers)
    .values({ id: `u_${id}`, name: id, email, emailVerified: true })
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
  'a session whose email is not allowlisted is refused',
);

// The allowlist is editable from the panel, and the edit applies to the next request.
// Start from a known list: a settings file left over from another run would win over the env.
writeSettings({ PANEL_ALLOWED_EMAILS: 'eu@exemplo.com' });
assert.equal(
  (await fetch(`${base}/api/panel/auth/access`)).status,
  401,
  'reading the allowlist needs a session',
);
const list = (await (
  await fetch(`${base}/api/panel/auth/access`, { headers: { cookie: inside } })
).json()) as { emails: string[] };
assert.deepEqual(list.emails, ['eu@exemplo.com'], 'the allowlist comes back lowercased');
const put = await fetch(`${base}/api/panel/auth/access`, {
  method: 'PUT',
  headers: { cookie: inside, 'content-type': 'application/json' },
  body: '{"emails":["EU@Exemplo.com","Novo@Exemplo.com","eu@exemplo.com"]}',
});
assert.equal(put.status, 200, 'saving the allowlist works');
assert.deepEqual(
  ((await put.json()) as { emails: string[] }).emails,
  ['eu@exemplo.com', 'novo@exemplo.com'],
  'duplicates collapse and case is normalised',
);
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
  'a malformed email is refused',
);
// The session that was inside the list keeps working after the edit; the file, not the process, wins.

assert.equal(liveSetting('PANEL_ALLOWED_EMAILS'), 'eu@exemplo.com,novo@exemplo.com');
writeSettings({ PANEL_ALLOWED_EMAILS: 'eu@exemplo.com' });
assert.equal(
  (await fetch(`${base}/api/panel/guilds`, { headers: { cookie: inside } })).status,
  200,
  'the remaining email still gets in',
);

assert.equal(
  (await fetch(`${base}/api/panel/guilds`, { headers: { cookie: outside } })).status,
  401,
  'removing an email from the allowlist refuses its session at once',
);
writeSettings({ PANEL_ALLOWED_EMAILS: '' });

await db.delete(authSchema.authSessions).where(eq(authSchema.authSessions.userId, 'u_inside'));
await db.delete(authSchema.authSessions).where(eq(authSchema.authSessions.userId, 'u_outside'));
await db.delete(authSchema.authUsers).where(eq(authSchema.authUsers.id, 'u_inside'));
await db.delete(authSchema.authUsers).where(eq(authSchema.authUsers.id, 'u_outside'));

assert.equal((await fetch(`${base}/../package.json`)).status, 404, 'no path traversal');
assert.equal((await fetch(`${base}/server.js`)).status, 404, 'only known extensions');

const bare = startHttpServer(client, 4398);
assert.equal(
  (await fetch('http://127.0.0.1:4398/api/panel/guilds')).status,
  503,
  'no PANEL_TOKEN → panel disabled, not open',
);
bare.close();

server.close();
await client.destroy();
rmSync(process.env.ROBOTECO_SETTINGS_PATH ?? '', { force: true });
// The Postgres pool keeps the event loop alive; close it so the check exits on its own.
const { closeDb } = await import('@/db');
await closeDb();
console.log('panel check ok');

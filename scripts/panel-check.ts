// Run with: pnpm panel:check
// Asserts the HTTP boundary: health, session gate, the public auth segment, static files.
import assert from 'node:assert/strict';
import { Client, GatewayIntentBits } from 'discord.js';

process.env.DATABASE_URL ??= 'postgres://roboteco:roboteco@localhost:5432/roboteco';
process.env.S3_ENDPOINT ??= 'http://localhost:3900';
process.env.S3_ACCESS_KEY_ID ??= 'x';
process.env.S3_SECRET_ACCESS_KEY ??= 'x';
process.env.S3_BUCKET ??= 'roboteco';
process.env.DISCORD_TOKEN ??= 'x';
process.env.DISCORD_CLIENT_ID ??= 'x';
process.env.PANEL_TOKEN ??= 'panel-check-token-123456';

const { startHttpServer } = await import('@/core/http');
const { inject, registerCommandCatalog, registerCommandOwners } = await import('@/core');
const { PanelAuthService } = await import('@/modules/panel/panel-auth.service');
const { registerPanelSettings } = await import('@/modules/panel/panel-settings.service');

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
const statusBody = (await status.json()) as { authenticated: boolean };
assert.equal(statusBody.authenticated, false, 'no cookie → not authenticated');

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
assert.equal(
  (await fetch(`${base}/api/panel/auth/login`, { method: 'POST', body: '{"password":"errada"}' }))
    .status,
  400,
  'a wrong password is rejected, not silently accepted',
);
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
console.log('panel check ok');

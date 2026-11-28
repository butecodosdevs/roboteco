import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import '@/app.module';
import { closeCache } from '@/cache';
import { inject } from '@/core';
import { closeDb } from '@/db';
import {
  type LoadedPlugin,
  PluginEngineService,
  PluginLoadError,
} from '@/modules/plugins/plugin-engine.service';
import { PluginEventsService } from '@/modules/plugins/plugin-events.service';
import { PluginHostService } from '@/modules/plugins/plugin-host.service';
import { PluginManifestService } from '@/modules/plugins/plugin-manifest.service';
import { PluginRegistryService } from '@/modules/plugins/plugin-registry.service';
import { uniqueGuildId } from './fakes';

// Built by `pnpm plugins:build` from plugins/fixtures/contract-rust.
const wasm = 'plugins/dist/contract.wasm';
const guildId = uniqueGuildId();
const botId = '100000000000000999';
const events = inject(PluginEventsService);
let plugin: LoadedPlugin;

const stored = async (key: string) =>
  (
    await inject(PluginHostService).get(
      { pluginId: 'contract', guildId, channelId: null, caller: null },
      { key },
    )
  ).value;

const message = (authorId: string, content: string) => ({
  t: 'MESSAGE_CREATE',
  d: {
    id: '600000000000000950',
    channel_id: '400000000000000950',
    guild_id: guildId,
    author: { id: authorId, username: 'someone', bot: false },
    content,
    embeds: [],
    attachments: [],
  },
});

before(async () => {
  if (!existsSync(wasm)) throw new Error(`${wasm} is missing: run pnpm plugins:build first`);
  plugin = await inject(PluginEngineService).load({
    id: 'contract',
    wasm,
    permissions: ['kv', 'events.members', 'intents.GuildMessages'],
  });
  inject(PluginRegistryService).add(plugin);
});

after(async () => {
  await inject(PluginHostService).purgeGuild(guildId);
  await inject(PluginRegistryService).unloadAll();
  await closeDb();
  await closeCache();
});

test('a subscribed Discord event reaches the plugin; unsubscribed and server-less ones do not', async () => {
  await events.gateway(
    { t: 'MESSAGE_DELETE', d: { id: '1', channel_id: '2', guild_id: guildId } },
    botId,
  );
  await events.gateway({ t: 'GUILD_ROLE_CREATE', d: { guild_id: guildId, role: {} } }, botId);
  await events.gateway({ t: 'MESSAGE_DELETE', d: { id: '1', channel_id: '2' } }, botId);
  assert.equal(await stored('gateway:MESSAGE_DELETE'), '1');
  assert.equal(await stored('gateway:GUILD_ROLE_CREATE'), null);
});

test('message content reaches a plugin only when the registry grants intents.MessageContent', async () => {
  await events.gateway(message('200000000000000950', 'secret plans'), botId);
  assert.equal(await stored('last-content'), '(none)');

  plugin.definition.permissions.push('intents.MessageContent');
  await events.gateway(message('200000000000000950', 'secret plans'), botId);
  assert.equal(await stored('last-content'), 'secret plans');
});

test("events the bot caused itself are not sent back, so a plugin can't loop on its own posts", async () => {
  const before = await stored('gateway:MESSAGE_CREATE');
  await events.gateway(message(botId, 'posted by a plugin'), botId);
  assert.equal(await stored('gateway:MESSAGE_CREATE'), before);
});

test('a plugin needs the intent of every Discord event it subscribes to', async () => {
  await assert.rejects(
    inject(PluginEngineService).load({
      id: 'contract-2',
      wasm,
      permissions: ['kv', 'events.members'],
    }),
    (error: unknown) =>
      error instanceof PluginLoadError &&
      /intents\.GuildMessages.*MESSAGE_CREATE/.test(error.message),
  );
});

test('events that carry tokens or a whole server cannot be subscribed to', () => {
  for (const event of ['INTERACTION_CREATE', 'VOICE_SERVER_UPDATE', 'GUILD_CREATE', 'READY']) {
    assert.throws(() =>
      inject(PluginManifestService).parse({
        name: 'x',
        version: '1',
        discordEvents: [event],
      }),
    );
  }
});

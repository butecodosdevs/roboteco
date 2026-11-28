import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import '@/app.module';
import { closeCache } from '@/cache';
import { config } from '@/config';
import { inject } from '@/core';
import { closeDb } from '@/db';
import { DiscordDataService } from '@/modules/plugins/discord-data.service';
import { InteractionCreateEvent } from '@/modules/plugins/events/interaction-create.event';
import { PluginEngineService } from '@/modules/plugins/plugin-engine.service';
import type { GatewayPacket } from '@/modules/plugins/plugin-events.service';
import {
  type GatewayEvent,
  gatewayEvents,
  intentPermission,
  PluginManifestService,
} from '@/modules/plugins/plugin-manifest.service';
import { PluginRegistryService } from '@/modules/plugins/plugin-registry.service';

const usage = `Usage: pnpm record-discord

Records one anonymized example of each Discord event and interaction from DISCORD_GUILD_ID into
tests/fixtures/discord, for tests/plugins/recorded.test.ts. Stop the bot first: this logs in as it.

While it runs, /fidelity and the "Echo user" / "Echo message" menus exist in that server. Use
/fidelity options (fill every option), /fidelity search, /fidelity panel (click, submit the form,
use every select), both menus, and then do whatever events you want covered: post, reply, forward,
edit, react, delete, pin, join voice, edit roles and channels, start threads, create invites,
polls, scheduled events. Ctrl+C removes the commands and stops.`;

const out = 'tests/fixtures/discord';
const recordedGuildId = '100000000000000001';
const recordedBotId = '100000000000000002';

/**
 * Replaces everything that identifies people or the server with stable placeholders, so the same
 * ID or name maps to the same value in every file, and relations between files still hold.
 */
class Anonymizer {
  private readonly ids = new Map<string, string>();
  private readonly texts = new Map<string, string>();
  private nextId = 3n;

  constructor(
    guildId: string,
    botId: string,
    private readonly known: Set<string>,
  ) {
    this.ids.set(guildId, recordedGuildId);
    this.ids.set(botId, recordedBotId);
  }

  private id(value: string): string {
    let mapped = this.ids.get(value);
    if (!mapped) {
      mapped = String(100000000000000000n + this.nextId++);
      this.ids.set(value, mapped);
    }
    return mapped;
  }

  private text(key: string, value: string): string {
    let mapped = this.texts.get(value);
    if (!mapped) {
      const n = this.texts.size + 1;
      mapped = /^https?:\/\//.test(value) ? `https://example.invalid/${key}-${n}` : `${key}-${n}`;
      this.texts.set(value, mapped);
    }
    return mapped;
  }

  private string(key: string, value: string): string {
    // Permission bitfields are digit strings as long as IDs.
    if (/^\d{17,20}$/.test(value) && !permissionKeys.has(key)) return this.id(value);
    if (/^\d{0,16}$/.test(value) || permissionKeys.has(key)) return value;
    if (/^\d{4}-\d\d-\d\dT[\d:.]+(Z|[+-]\d\d:\d\d)$/.test(value)) return value;
    if (enumKeys.has(key) || this.known.has(value) || value.startsWith('plg:echo:')) return value;
    // Unicode emoji (reaction names) say nothing about anyone.
    if (key === 'name' && !/[\p{L}\p{N}]/u.test(value)) return value;
    return this.text(key, value);
  }

  apply(value: unknown, key = ''): unknown {
    if (typeof value === 'string') return this.string(key, value);
    if (Array.isArray(value)) return value.map((item) => this.apply(item, key));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          /^\d{17,20}$/.test(k) ? this.id(k) : k,
          this.apply(v, k),
        ]),
      );
    }
    return value;
  }
}

const permissionKeys = new Set(['permissions', 'allow', 'deny', 'app_permissions']);
const enumKeys = new Set([
  't',
  'status',
  'desktop',
  'mobile',
  'web',
  'locale',
  'guild_locale',
  'preferred_locale',
  'content_type',
  'key',
]);

// biome-ignore lint/suspicious/noExplicitAny: raw Discord JSON, read loosely
type Json = Record<string, any>;

function messageVariant(d: Json): string {
  if (d.message_snapshots?.length) return '.forward';
  if (d.referenced_message) return '.reply';
  if (d.poll) return '.poll';
  if (d.attachments?.length) return '.attachment';
  if (d.embeds?.length) return '.embed';
  return '';
}

const componentNames: Record<number, string> = {
  2: 'button',
  3: 'string-select',
  5: 'user-select',
  6: 'role-select',
  8: 'channel-select',
};

function interactionName(d: Json): string | null {
  if (d.type === 2) {
    if (d.data.type === 2) return 'user-menu';
    if (d.data.type === 3) return 'message-menu';
    return `command.${d.data.options?.[0]?.name ?? d.data.name}`;
  }
  if (d.type === 3) return componentNames[d.data.component_type] ?? null;
  if (d.type === 4) return 'autocomplete';
  if (d.type === 5) return 'modal';
  return null;
}

function collectStrings(value: unknown, into: Set<string>): Set<string> {
  if (typeof value === 'string') into.add(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, into);
  else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, into);
  }
  return into;
}

if (process.argv.includes('--help')) {
  process.stdout.write(`${usage}\n`);
  process.exit(0);
}
if (!config.guildId) throw new Error('Set DISCORD_GUILD_ID to the test server to record from');
const guildId: string = config.guildId;

const engine = inject(PluginEngineService);
const manifests = inject(PluginManifestService);
const echo = await engine.load({
  id: 'echo',
  wasm: 'plugins/dist/echo.wasm',
  permissions: [
    'kv',
    ...new Set(Object.values(gatewayEvents).map((intent) => intentPermission(intent))),
  ],
});
inject(PluginRegistryService).add(echo);

const privileged = [
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildPresences,
  GatewayIntentBits.MessageContent,
];
const intents = Object.values(GatewayIntentBits)
  .filter((bit): bit is GatewayIntentBits => typeof bit === 'number')
  .filter((bit) => config.privilegedIntents || !privileged.includes(bit));
const client = new Client({
  intents,
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});

const commands = [
  ...echo.commands.map((spec) => manifests.toCommandJSON(spec)),
  ...echo.contextMenus.map((spec) => manifests.toContextMenuJSON(spec)),
];
const known = collectStrings(commands, new Set());
for (const literal of ['red', 'blue', 'Red', 'Blue', 'recorded', 'short', 'long', 'echo'])
  known.add(literal);
let anonymizer: Anonymizer | undefined;
const seen = new Set<string>();
const registered: string[] = [];

function save(folder: string, name: string, packet: unknown) {
  if (!anonymizer || seen.has(`${folder}/${name}`)) return;
  seen.add(`${folder}/${name}`);
  mkdirSync(join(out, folder), { recursive: true });
  const file = join(out, folder, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(anonymizer.apply(packet), null, 2)}\n`);
  process.stdout.write(`recorded ${file}\n`);
}

client.on(Events.Raw as never, (packet: GatewayPacket) => {
  const d = packet.d as Json | undefined;
  if (!packet.t || !d) return;
  // GUILD_CREATE arrives before ClientReady, so the bot's ID is taken from READY itself.
  if (packet.t === 'READY') anonymizer = new Anonymizer(guildId, d.user.id, known);
  if (packet.t === 'GUILD_CREATE' && d.id === guildId) {
    const { id, name, owner_id, preferred_locale, member_count, icon, roles, channels } = d;
    save('', 'server', {
      botId: client.user?.id,
      guild: { id, name, owner_id, preferred_locale, member_count, icon, roles, channels },
    });
    return;
  }
  if ((d.guild_id ?? d.id) !== guildId) return;
  if (packet.t === 'INTERACTION_CREATE') {
    const name = interactionName(d);
    if (name) save('interactions', name, { t: packet.t, d });
    return;
  }
  if (!Object.hasOwn(gatewayEvents, packet.t)) return;
  const event = packet.t as GatewayEvent;
  const variant = event.startsWith('MESSAGE_') ? messageVariant(d) : '';
  const byBot = [d.author?.id, d.user_id, d.user?.id, d.member?.user?.id].includes(client.user?.id);
  save('gateway', `${event}${variant}${byBot ? '.bot' : ''}`, { t: packet.t, d });
});

const listener = new InteractionCreateEvent();
client.on(Events.InteractionCreate, (interaction) => {
  listener.execute(interaction).catch((error) => process.stderr.write(`${error}\n`));
});

client.once(Events.ClientReady, async (ready) => {
  inject(DiscordDataService).attach(ready);
  const guild = await ready.guilds.fetch(guildId);
  for (const command of commands) registered.push((await guild.commands.create(command)).id);
  process.stdout.write(`${usage}\n\nRecording from ${guild.name}.\n`);
});

async function stop() {
  const guild = client.guilds.cache.get(guildId);
  for (const id of registered) await guild?.commands.delete(id).catch(() => undefined);
  await client.destroy();
  await inject(PluginRegistryService).unloadAll();
  await closeDb();
  await closeCache();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

await client.login(config.token);

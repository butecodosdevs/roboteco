import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { Client, Events, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import '@/app.module';
import { closeCache } from '@/cache';
import { inject } from '@/core';
import { closeDb } from '@/db';
import { InteractionCreateEvent } from '@/modules/plugins/events/interaction-create.event';
import { type LoadedPlugin, PluginEngineService } from '@/modules/plugins/plugin-engine.service';
import { PluginEventsService } from '@/modules/plugins/plugin-events.service';
import { PluginHostService } from '@/modules/plugins/plugin-host.service';
import {
  eventInputSchema,
  gatewayEvents,
  intentPermission,
  invocationSchema,
  messageContentPermission,
} from '@/modules/plugins/plugin-manifest.service';
import { PluginRegistryService } from '@/modules/plugins/plugin-registry.service';
import { uniqueGuildId } from './fakes';
import { typedDispatches } from './typed-dispatches';

// Real Discord payloads, recorded with `/dev record` and anonymized. Each one is replayed
// into the echo fixture, which saves exactly what it received; that must match what Discord sent.
const dir = 'tests/fixtures/discord';
const wasm = 'plugins/dist/echo.wasm';
const goWasm = 'plugins/dist/echo-go.wasm';
const recordedGuildId = '100000000000000001';
// UPDATE_FIXTURES=1 rewrites tests/fixtures/discord/invocations, the reviewed record of what
// plugins receive for each interaction.
const updateFixtures = process.env.UPDATE_FIXTURES === '1';

type Json = Record<string, any>;
const server = JSON.parse(readFileSync(join(dir, 'server.json'), 'utf8')) as {
  botId: string;
  guild: Json;
};
const recordings = (folder: string) =>
  (existsSync(join(dir, folder)) ? readdirSync(join(dir, folder)) : [])
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({
      name: file.slice(0, -'.json'.length),
      text: readFileSync(join(dir, folder, file), 'utf8'),
    }));

// Each replay gets its own server, so the echoes and the plugin's rate limit never mix.
const inServer = <T>(text: string, guildId: string): T =>
  JSON.parse(text.replaceAll(`"${recordedGuildId}"`, `"${guildId}"`));
const guildIds: string[] = [];
const freshGuild = () => {
  const id = uniqueGuildId();
  guildIds.push(id);
  return id;
};

/** A document the echo fixtures saved: `input` (what the bot sent) or `sdk` (what the SDK read). */
async function saved(
  pluginId: string,
  guildId: string,
  doc: 'input' | 'sdk',
): Promise<Json | null> {
  const host = inject(PluginHostService);
  const get = async (key: string) =>
    (await host.get({ pluginId, guildId, channelId: null, caller: null }, { key })).value;
  const count = await get(doc);
  if (count === null) return null;
  let text = '';
  for (let i = 0; i < Number(count); i++) text += await get(`${doc}:${i}`);
  return JSON.parse(text);
}

/**
 * Drops what an SDK may leave out or fill with a zero value (null, "", 0, false, empty lists and
 * maps), so an SDK's view compares with the JSON it read. A field the SDK misreads still differs.
 */
function compact(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(compact).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, compact(item)] as const)
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return value === null || value === '' || value === 0 || value === false ? undefined : value;
}

/** Hands the input the Rust fixture got to the Go fixture, and checks both SDKs read all of it. */
async function assertSdksRead(
  guildId: string,
  input: Json,
  deliver: (go: LoadedPlugin) => Promise<unknown>,
) {
  const rust = await saved('echo', guildId, 'sdk');
  assert.ok(rust, 'the Rust fixture saved nothing');
  assert.deepEqual(compact(rust), compact(input), 'the Rust SDK misread the input');
  await deliver(goPlugin);
  const go = await saved('echo-go', guildId, 'sdk');
  assert.ok(go, 'the Go fixture saved nothing');
  assert.deepEqual(compact(go), compact(input), 'the Go SDK misread the input');
}

let echoPlugin: LoadedPlugin;
let goPlugin: LoadedPlugin;

before(async () => {
  for (const file of [wasm, goWasm]) {
    if (!existsSync(file)) throw new Error(`${file} is missing: run pnpm plugins:build first`);
  }
  const intents = [...new Set(Object.values(gatewayEvents))].map((intent) =>
    intentPermission(intent),
  );
  const engine = inject(PluginEngineService);
  const registry = inject(PluginRegistryService);
  echoPlugin = await engine.load({ id: 'echo', wasm, permissions: ['kv', ...intents] });
  // It takes over /dev fidelity and the Fidelity menus, which the dev module owns outside tests.
  registry.add(echoPlugin, () => false);
  // Not in the registry: it gets the inputs the Rust fixture got, straight from the engine.
  goPlugin = await engine.load({ id: 'echo-go', wasm: goWasm, permissions: ['kv'] });
});

after(async () => {
  for (const id of guildIds) await inject(PluginHostService).purgeGuild(id);
  await inject(PluginRegistryService).unloadAll();
  await goPlugin?.instance.close();
  await closeDb();
  await closeCache();
});

const messageEvents = new Set(['MESSAGE_CREATE', 'MESSAGE_UPDATE']);
const messageContentKeys = new Set(['content', 'embeds', 'attachments', 'components', 'poll']);

function omitDeep(value: unknown, keys: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => omitDeep(item, keys));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !keys.has(key))
        .map(([key, item]) => [key, omitDeep(item, keys)]),
    );
  }
  return value;
}

/** What Discord itself leaves out for a bot without the Message Content intent. */
function withoutContent(event: string, data: Json): unknown {
  if (messageEvents.has(event)) return omitDeep(data, messageContentKeys);
  if (event === 'AUTO_MODERATION_ACTION_EXECUTION') {
    return omitDeep(data, new Set(['content', 'matched_content']));
  }
  return data;
}

/** Replays a recorded event into a fresh server, with or without the message content grant. */
async function replay(text: string, readsContent: boolean) {
  const permissions = echoPlugin.definition.permissions;
  if (readsContent) permissions.push(messageContentPermission);
  try {
    const guildId = freshGuild();
    const { t, d } = inServer<{ t: string; d: Json }>(text, guildId);
    await inject(PluginEventsService).gateway({ t, d }, server.botId);
    return { guildId, t, d, input: await saved('echo', guildId, 'input') };
  } finally {
    if (readsContent) permissions.pop();
  }
}

const recorded = recordings('gateway');
// A typed payload stands in only until a real one of the same event is recorded.
const typed = Object.entries(typedDispatches)
  .filter(([, packet]) => !recorded.some(({ name }) => name.split('.')[0] === packet.t))
  .map(([name, packet]) => ({ name, text: JSON.stringify(packet) }));

describe('recorded Discord events', () => {
  for (const { name, text } of [...recorded, ...typed]) {
    test(name, async () => {
      const plain = await replay(text, false);
      const full = await replay(text, true);
      if (/\.(typed-)?bot$/.test(name) || Buffer.byteLength(JSON.stringify(full.d)) > 64 * 1024) {
        assert.equal(plain.input, null);
        assert.equal(full.input, null);
        return;
      }
      const expected = ({ t, d, guildId }: typeof plain) => ({
        event: t,
        guildId,
        channelId: typeof d.channel_id === 'string' ? d.channel_id : null,
      });
      assert.deepEqual(full.input, { ...expected(full), data: full.d });
      assert.deepEqual(plain.input, { ...expected(plain), data: withoutContent(plain.t, plain.d) });
      const input = eventInputSchema.parse(full.input);
      await assertSdksRead(full.guildId, input, (go) =>
        inject(PluginEngineService).event(go, input),
      );
    });
  }
});

const kinds: Record<string, string> = {
  'user-menu': 'userMenu',
  'message-menu': 'messageMenu',
  autocomplete: 'autocomplete',
  modal: 'modal',
  button: 'button',
};

function permissionNames(bits: string): string[] {
  const permissions = new PermissionsBitField(BigInt(bits));
  return permissions.has(PermissionFlagsBits.Administrator)
    ? new PermissionsBitField(PermissionsBitField.All).toArray()
    : permissions.toArray();
}

function avatarUrl(guildId: string, member: Json, user: Json): string {
  const cdn = 'https://cdn.discordapp.com';
  const ext = (hash: string) => (hash.startsWith('a_') ? 'gif' : 'webp');
  if (member.avatar) {
    return `${cdn}/guilds/${guildId}/users/${user.id}/avatars/${member.avatar}.${ext(member.avatar)}`;
  }
  if (user.avatar) return `${cdn}/avatars/${user.id}/${user.avatar}.${ext(user.avatar)}`;
  return `${cdn}/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
}

/** The plugin's view of a member, worked out from Discord's JSON by hand. */
function member(guild: Json, raw: Json, user: Json) {
  return {
    id: user.id,
    username: user.username,
    displayName: raw.nick ?? user.global_name ?? user.username,
    avatarUrl: avatarUrl(guild.id, raw, user),
    bot: user.bot ?? false,
    owner: user.id === guild.owner_id,
    roles: raw.roles,
    joinedAt: raw.joined_at ? new Date(raw.joined_at).toISOString() : null,
  };
}

function resolved(guild: Json, data: Json) {
  const r = data.resolved ?? {};
  const map = <T>(entries: Json | undefined, f: (id: string, value: Json) => T) =>
    Object.fromEntries(Object.entries(entries ?? {}).map(([id, value]) => [id, f(id, value)]));
  return {
    members: map(r.members, (id, value) => member(guild, value, r.users[id])),
    roles: map(r.roles, (_, role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
    })),
    channels: map(r.channels, (_, channel) => ({
      id: channel.id,
      name: channel.name ?? null,
      type: channel.type,
    })),
  };
}

function textInputs(components: unknown, into: Record<string, string> = {}) {
  if (Array.isArray(components)) for (const c of components) textInputs(c, into);
  else if (components && typeof components === 'object') {
    const c = components as Json;
    if (c.type === 4) into[c.custom_id] = c.value;
    textInputs(c.components ?? c.component, into);
  }
  return into;
}

/** The whole input the plugin should get for an interaction, from Discord's JSON alone. */
function expectedInvocation(name: string, d: Json, guild: Json) {
  const data = d.data;
  const caller = d.member;
  const channel = guild.channels.find((c: Json) => c.id === d.channel.id);
  const base = {
    kind: kinds[name] ?? (name === 'command' ? 'command' : 'select'),
    command: d.type === 2 || d.type === 4 ? data.name : '',
    subcommand: null as string | null,
    options: {} as Json,
    userId: caller.user.id,
    guildId: guild.id,
    channelId: d.channel.id,
    locale: d.locale,
    permissions: permissionNames(caller.permissions),
    context: {
      member: member(guild, caller, caller.user),
      guild: {
        id: guild.id,
        name: guild.name,
        memberCount: guild.member_count,
        locale: guild.preferred_locale,
        iconUrl: guild.icon
          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp`
          : null,
      },
      channel: { id: channel.id, name: channel.name ?? null, type: channel.type },
    },
    resolved: { members: {}, roles: {}, channels: {} } as Json,
  };
  if (d.type === 2 && data.type === 1) {
    const [sub] = data.options ?? [];
    const options = sub?.type === 1 ? (sub.options ?? []) : (data.options ?? []);
    return {
      ...base,
      subcommand: sub?.type === 1 ? sub.name : null,
      options: Object.fromEntries(options.map((o: Json) => [o.name, o.value])),
      resolved: resolved(guild, data),
    };
  }
  if (d.type === 4) {
    const [sub] = data.options ?? [];
    const options = sub?.type === 1 ? (sub.options ?? []) : (data.options ?? []);
    const focused = options.find((o: Json) => o.focused);
    return {
      ...base,
      subcommand: sub?.type === 1 ? sub.name : null,
      options: Object.fromEntries(options.map((o: Json) => [o.name, o.value])),
      focused: { name: focused.name, value: String(focused.value) },
    };
  }
  if (d.type === 2 && data.type === 2) {
    const target = data.resolved.members?.[data.target_id];
    return {
      ...base,
      target: {
        userId: data.target_id,
        member: target ? member(guild, target, data.resolved.users[data.target_id]) : null,
        message: null,
      },
    };
  }
  if (d.type === 2 && data.type === 3) {
    const message = data.resolved.messages[data.target_id];
    return {
      ...base,
      target: {
        userId: message.author.id,
        member: null,
        message: {
          id: message.id,
          channelId: message.channel_id,
          authorId: message.author.id,
          content: message.content,
          attachments: message.attachments.map((a: Json) => a.url),
        },
      },
    };
  }
  return {
    ...base,
    resolved: resolved(guild, data),
    component: {
      id: data.custom_id.replace(/^plg:echo:/, ''),
      values: data.values ?? [],
      fields: d.type === 5 ? textInputs(data.components) : {},
      messageId: d.message?.id ?? null,
    },
  };
}

/** Lets discord.js build the interaction from Discord's JSON, as it does from the gateway. */
function discordInteraction(d: Json, guild: Json) {
  const client: any = new Client({ intents: [] });
  client.guilds._add(guild);
  let built: any;
  client.once(Events.InteractionCreate, (interaction: unknown) => {
    built = interaction;
  });
  client.actions.InteractionCreate.handle(d);
  assert.ok(built, 'discord.js did not build an interaction from the recording');
  const answer = async () => {
    built.replied = true;
    return { resource: { message: null } };
  };
  for (const method of ['reply', 'update', 'editReply', 'followUp', 'showModal', 'respond']) {
    built[method] = answer;
  }
  built.deferReply = built.deferUpdate = async () => {
    built.deferred = true;
  };
  return { interaction: built, client };
}

/** The dev module's component IDs as the echo plugin's: the only change made to a recording. */
function pluginComponentId(id: string): string {
  const [name, arg] = id.split(':');
  const own: Record<string, string> = {
    'dev.fidelityButton': 'form',
    'dev.fidelitySelect': arg ?? '',
    'dev.fidelityModal': 'feedback',
  };
  return `plg:echo:${own[name ?? ''] ?? id}`;
}

describe('recorded Discord interactions', () => {
  for (const { name, text } of recordings('interactions')) {
    test(name, async () => {
      const guildId = freshGuild();
      const { d } = inServer<{ d: Json }>(text, guildId);
      if (d.data.custom_id) d.data.custom_id = pluginComponentId(d.data.custom_id);
      const guild = inServer<Json>(JSON.stringify(server.guild), guildId);
      const { interaction, client } = discordInteraction(d, guild);
      // A listener per replay: they share a user, and its cooldown would refuse the next command.
      await new InteractionCreateEvent().execute(interaction);
      await client.destroy();

      const input = await saved('echo', guildId, 'input');
      assert.ok(input, 'the interaction did not reach the plugin');
      assert.deepEqual(input, expectedInvocation(name, d, guild));
      const invocation = invocationSchema.parse(input);
      const engine = inject(PluginEngineService);
      await assertSdksRead(guildId, input, (go) =>
        invocation.kind === 'autocomplete'
          ? engine.autocomplete(go, invocation, null)
          : engine.interact(go, invocation, null),
      );

      const golden = join(dir, 'invocations', `${name}.json`);
      const normalized = `${JSON.stringify(input, null, 2).replaceAll(`"${guildId}"`, `"${recordedGuildId}"`)}\n`;
      if (updateFixtures) {
        mkdirSync(join(dir, 'invocations'), { recursive: true });
        writeFileSync(golden, normalized);
      }
      assert.deepEqual(
        JSON.parse(normalized),
        JSON.parse(readFileSync(golden, 'utf8')),
        `${golden} is stale`,
      );
    });
  }
});

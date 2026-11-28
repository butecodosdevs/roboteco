import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import '@/app.module';
import { PermissionsBitField } from 'discord.js';
import { closeCache } from '@/cache';
import { allCapabilities, inject } from '@/core';
import { closeDb } from '@/db';
import type { MemberData } from '@/modules/plugins/discord-data.service';
import {
  type Invocation,
  knownPermissions,
  type LoadedPlugin,
  type PluginAction,
  PluginCallError,
  PluginEngineService,
} from '@/modules/plugins/plugin-engine.service';
import {
  choicesSchema,
  eventDataSchemas,
  eventInputSchema,
  invocationSchema,
  jobInputSchema,
  manifestSchema,
  type PluginCommandSpec,
  type PluginEvent,
  pluginEvents,
  responseSchema,
} from '@/modules/plugins/plugin-manifest.service';

const usage = `Usage:
  pnpm plugin check <file.wasm>                      validate the manifest and list what it needs
  pnpm plugin run <file.wasm> <command> [subcommand] [name=value ...]
                                                     run a slash command
  pnpm plugin click <file.wasm> <id> [value ...]     click a button (or pick select values)
  pnpm plugin submit <file.wasm> <id> [field=value ...]
                                                     submit a form
  pnpm plugin event <file.wasm> <event> ['{json}']   deliver an event (data shape: pnpm plugin schema)
  pnpm plugin job <file.wasm> [key] ['{json}']       run a scheduled job now
  pnpm plugin schema [output.json]                   write the JSON Schema of the plugin contract

Options for run, click and submit:
  --user <id> --guild <id> --locale <locale>
  --perms <Name,Name>   the caller's permissions (default: all), e.g. --perms SendMessages

Discord actions (posting, roles, moderation) need a live bot and fail here with "no_server".`;

const devGuild = '100000000000000001';
const devUser = '100000000000000002';

function devMember(id: string, name: string): MemberData {
  return {
    id,
    username: name.toLowerCase(),
    displayName: name,
    avatarUrl: '',
    bot: false,
    owner: false,
    roles: [],
    joinedAt: null,
  };
}

function coerce(spec: PluginCommandSpec, subcommand: string | null, raw: Record<string, string>) {
  const options =
    (subcommand ? spec.subcommands?.find((s) => s.name === subcommand)?.options : spec.options) ??
    [];
  const values: Invocation['options'] = {};
  const members: Record<string, MemberData> = {};
  for (const [name, value] of Object.entries(raw)) {
    const option = options.find((o) => o.name === name);
    if (!option)
      throw new Error(
        `/${spec.name} has no option "${name}"; options: ${options.map((o) => o.name).join(', ') || 'none'}`,
      );
    values[name] =
      option.type === 'integer' || option.type === 'number'
        ? Number(value)
        : option.type === 'boolean'
          ? value === 'true'
          : value;
    // Discord enforces these before the plugin sees the value; do the same here.
    const n = values[name];
    if (typeof n === 'number') {
      if (Number.isNaN(n) || (option.type === 'integer' && !Number.isInteger(n))) {
        throw new Error(`${name} must be a${option.type === 'integer' ? 'n integer' : ' number'}`);
      }
      if (option.minValue !== undefined && n < option.minValue) {
        throw new Error(`${name} must be at least ${option.minValue}`);
      }
      if (option.maxValue !== undefined && n > option.maxValue) {
        throw new Error(`${name} must be at most ${option.maxValue}`);
      }
    }
    if (option.choices && !option.choices.some((c) => String(c.value) === value)) {
      throw new Error(`${name} must be one of: ${option.choices.map((c) => c.value).join(', ')}`);
    }
    if (option.type === 'user') members[value] = devMember(value, `User${value.slice(-4)}`);
  }
  const missing = options.filter((o) => o.required && !(o.name in values)).map((o) => o.name);
  if (missing.length > 0) throw new Error(`missing required option(s): ${missing.join(', ')}`);
  return { values, members };
}

async function load(wasm: string) {
  // Each plugin keeps its own storage and XP budgets, as it would in the bot.
  const id =
    basename(wasm, '.wasm')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 32) || 'dev';
  return inject(PluginEngineService).load({
    id,
    wasm,
    permissions: [...knownPermissions()],
  });
}

async function check(wasm: string) {
  const plugin = await load(wasm);
  console.log(`✔ ${wasm}: version ${plugin.version}`);
  for (const spec of plugin.commands) {
    const subs = spec.subcommands?.map((s) => s.name).join(', ');
    console.log(`  /${spec.name}${subs ? ` (${subs})` : ''}: ${spec.description}`);
  }
  for (const menu of plugin.contextMenus) console.log(`  ${menu.type} menu: ${menu.name}`);
  if (plugin.events.length > 0) console.log(`  events: ${plugin.events.join(', ')}`);
  console.log(`  uses: ${[...plugin.access.uses].join(', ') || 'nothing'}`);
  console.log(
    `  permissions to grant in plugins/registry.json: ${JSON.stringify(plugin.permissions)}`,
  );
  console.log(
    `  exports: ${[...plugin.exports].filter((e) => !e.startsWith('_') && e !== 'memory').join(', ')} · context: ${plugin.context.join(', ') || 'none'}`,
  );
  await plugin.instance.close();
}

type Flags = { user?: string; guild?: string; locale?: string; perms?: string };

function invocation(flags: Flags, fields: Partial<Invocation>): Invocation {
  const userId = flags.user ?? devUser;
  const guildId = flags.guild ?? devGuild;
  const permissions = flags.perms
    ? new PermissionsBitField(flags.perms.split(',') as never).toArray()
    : new PermissionsBitField(PermissionsBitField.All).toArray();
  return invocationSchema.parse({
    kind: 'command',
    command: '',
    subcommand: null,
    options: {},
    userId,
    guildId,
    channelId: '100000000000000003',
    locale: flags.locale ?? 'en-US',
    permissions,
    context: {
      member: devMember(userId, 'Dev'),
      guild: { id: guildId, name: 'Dev server', memberCount: 1, locale: 'en-US', iconUrl: null },
    },
    resolved: { members: {}, roles: {}, channels: {} },
    ...fields,
  });
}

function show(actions: PluginAction[]) {
  for (const action of actions) {
    if (action.type === 'modal') {
      console.log(`[form ${action.id}] ${action.title}`);
      for (const f of action.fields) console.log(`  ${f.id}: ${f.label}${f.required ? ' *' : ''}`);
      continue;
    }
    const tag = action.type === 'update' ? '[update] ' : action.ephemeral ? '(private) ' : '';
    if (action.content) console.log(`${tag}${action.content}`);
    for (const embed of action.embeds ?? []) {
      console.log(`${tag}┌ ${embed.title ?? ''}`);
      if (embed.description) console.log(`│ ${embed.description.replaceAll('\n', '\n│ ')}`);
      for (const field of embed.fields ?? []) console.log(`│ ${field.name}: ${field.value}`);
      if (embed.footer) console.log(`└ ${embed.footer.text}`);
    }
    for (const row of action.components ?? []) {
      console.log(
        `  ${row
          .map((c) =>
            c.type === 'button'
              ? `[${c.label ?? c.emoji}${c.id ? ` → ${c.id}` : ` → ${c.url}`}]`
              : `<${c.menu} select ${c.id}: ${(c.options ?? []).map((o) => o.value).join('|')}>`,
          )
          .join(' ')}`,
      );
    }
  }
}

async function attempt(plugin: LoadedPlugin, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    if (!(error instanceof PluginCallError)) throw error;
    console.error(`✘ plugin ${error.reason}: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await plugin.instance.close();
  }
}

const callerOf = (input: Invocation) => ({
  userId: input.userId,
  permissions: new PermissionsBitField(input.permissions as never).bitfield,
});

async function run(wasm: string, words: string[], flags: Flags) {
  const plugin = await load(wasm);
  const [command = '', ...rest] = words;
  const spec = plugin.commands.find((c) => c.name === command);
  if (!spec)
    throw new Error(
      `no command "${command}"; commands: ${plugin.commands.map((c) => c.name).join(', ')}`,
    );
  const subcommand =
    spec.subcommands?.length && rest[0] && !rest[0].includes('=') ? (rest.shift() as string) : null;
  if (spec.subcommands?.length && !subcommand) {
    throw new Error(
      `/${command} needs a subcommand: ${spec.subcommands.map((s) => s.name).join(', ')}`,
    );
  }
  const raw = Object.fromEntries(
    rest.map((pair) => pair.split(/=(.*)/s).slice(0, 2) as [string, string]),
  );
  const { values, members } = coerce(spec, subcommand, raw);
  const input = invocation(flags, {
    command,
    subcommand,
    options: values,
    resolved: { members, roles: {}, channels: {} },
  });
  await attempt(plugin, async () =>
    show(await inject(PluginEngineService).interact(plugin, input, callerOf(input))),
  );
}

async function click(wasm: string, id: string, values: string[], flags: Flags) {
  const plugin = await load(wasm);
  const input = invocation(flags, {
    kind: values.length > 0 ? 'select' : 'button',
    component: { id, values, fields: {}, messageId: '100000000000000004' },
  });
  await attempt(plugin, async () =>
    show(await inject(PluginEngineService).interact(plugin, input, callerOf(input))),
  );
}

async function submit(wasm: string, id: string, pairs: string[], flags: Flags) {
  const plugin = await load(wasm);
  const fields = Object.fromEntries(
    pairs.map((pair) => pair.split(/=(.*)/s).slice(0, 2) as [string, string]),
  );
  const input = invocation(flags, {
    kind: 'modal',
    component: { id, values: [], fields, messageId: null },
  });
  await attempt(plugin, async () =>
    show(await inject(PluginEngineService).interact(plugin, input, callerOf(input))),
  );
}

async function event(wasm: string, name: string, json: string | undefined, flags: Flags) {
  if (!(name in pluginEvents)) {
    throw new Error(`no event "${name}"; events: ${Object.keys(pluginEvents).join(', ')}`);
  }
  const plugin = await load(wasm);
  if (!plugin.events.includes(name as PluginEvent)) {
    await plugin.instance.close();
    throw new Error(`the plugin does not subscribe to ${name}`);
  }
  const data = eventDataSchemas[name as PluginEvent].parse(JSON.parse(json ?? '{}'));
  await attempt(plugin, async () => {
    await inject(PluginEngineService).event(plugin, {
      event: name as PluginEvent,
      guildId: flags.guild ?? devGuild,
      channelId: '100000000000000003',
      data: data as Record<string, unknown>,
    });
    console.log(`✔ delivered ${name}`);
  });
}

async function job(wasm: string, key: string | undefined, json: string | undefined, flags: Flags) {
  const plugin = await load(wasm);
  await attempt(plugin, async () => {
    await inject(PluginEngineService).job(plugin, {
      key: key ?? null,
      guildId: flags.guild ?? devGuild,
      channelId: '100000000000000003',
      data: json ? JSON.parse(json) : null,
    });
    console.log(`✔ ran job ${key ?? '(no key)'}`);
  });
}

async function schema(output = 'plugins/sdk/schema.json') {
  const json = (schema: z.ZodType) =>
    z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  const contract = {
    $comment: 'Generated by pnpm plugin schema. Do not edit.',
    manifest: json(manifestSchema),
    handleCommand: { input: json(invocationSchema), output: json(responseSchema) },
    handleComponent: { input: json(invocationSchema), output: json(responseSchema) },
    autocomplete: { input: json(invocationSchema), output: json(choicesSchema) },
    handleEvent: {
      input: json(eventInputSchema),
      data: Object.fromEntries(
        Object.entries(eventDataSchemas).map(([name, schema]) => [
          name,
          { permission: pluginEvents[name as PluginEvent], data: json(schema) },
        ]),
      ),
    },
    handleJob: { input: json(jobInputSchema) },
    capabilities: Object.fromEntries(
      allCapabilities()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => [
          c.name,
          {
            description: c.description,
            permission: c.permission ?? null,
            input: json(c.input),
            output: json(c.output),
          },
        ]),
    ),
  };
  await writeFile(output, `${JSON.stringify(contract, null, 2)}\n`);
  console.log(`wrote ${output} (${Object.keys(contract.capabilities).length} capabilities)`);
}

const { positionals, values: flags } = parseArgs({
  allowPositionals: true,
  options: {
    user: { type: 'string' },
    guild: { type: 'string' },
    locale: { type: 'string' },
    perms: { type: 'string' },
  },
});
const [action, file, ...words] = positionals;
try {
  if (action === 'check' && file) await check(file);
  else if (action === 'run' && file) await run(file, words, flags);
  else if (action === 'click' && file && words[0])
    await click(file, words[0], words.slice(1), flags);
  else if (action === 'submit' && file && words[0])
    await submit(file, words[0], words.slice(1), flags);
  else if (action === 'event' && file && words[0]) await event(file, words[0], words[1], flags);
  else if (action === 'job' && file) await job(file, words[0], words[1], flags);
  else if (action === 'schema') await schema(file);
  else {
    console.log(usage);
    process.exitCode = action ? 1 : 0;
  }
} catch (error) {
  console.error(`✘ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await closeDb();
  await closeCache();
}
process.exit();

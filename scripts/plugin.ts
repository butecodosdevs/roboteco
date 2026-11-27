import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import '@/app.module';
import { closeCache } from '@/cache';
import { allCapabilities, inject } from '@/core';
import { closeDb } from '@/db';
import type { MemberData } from '@/modules/plugins/discord-data.service';
import {
  type CommandInput,
  knownPermissions,
  PluginCallError,
  PluginEngineService,
} from '@/modules/plugins/plugin-engine.service';
import {
  choicesSchema,
  commandInputSchema,
  commandOutputSchema,
  manifestSchema,
  type PluginCommandSpec,
} from '@/modules/plugins/plugin-manifest.service';

const usage = `Usage:
  pnpm plugin check <file.wasm>                          validate the manifest and list what it needs
  pnpm plugin run <file.wasm> <command> [subcommand] [name=value ...]
        [--user <id>] [--guild <id>] [--locale <locale>]  run a command without Discord
  pnpm plugin schema [output.json]                       write the JSON Schema of the plugin contract`;

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
  const values: CommandInput['options'] = {};
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
    if (option.type === 'user') members[value] = devMember(value, `User${value.slice(-4)}`);
  }
  const missing = options.filter((o) => o.required && !(o.name in values)).map((o) => o.name);
  if (missing.length > 0) throw new Error(`missing required option(s): ${missing.join(', ')}`);
  return { values, members };
}

async function load(wasm: string) {
  return inject(PluginEngineService).load({
    id: 'dev',
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
  console.log(`  uses: ${[...plugin.access.uses].join(', ') || 'nothing'}`);
  console.log(
    `  permissions to grant in plugins/registry.json: ${JSON.stringify(plugin.permissions)}`,
  );
  console.log(
    `  autocomplete: ${plugin.autocompletes ? 'yes' : 'no'} · context: ${plugin.context.join(', ') || 'none'}`,
  );
  await plugin.instance.close();
}

async function run(
  wasm: string,
  words: string[],
  flags: { user?: string; guild?: string; locale?: string },
) {
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
  const userId = flags.user ?? devUser;
  const input: CommandInput = commandInputSchema.parse({
    command,
    subcommand,
    options: values,
    userId,
    guildId: flags.guild ?? devGuild,
    channelId: '100000000000000003',
    locale: flags.locale ?? 'en-US',
    context: {
      member: devMember(userId, 'Dev'),
      guild: {
        id: flags.guild ?? devGuild,
        name: 'Dev server',
        memberCount: 1,
        locale: 'en-US',
        iconUrl: null,
      },
    },
    resolved: { members, roles: {}, channels: {} },
  });
  try {
    for (const action of await inject(PluginEngineService).run(plugin, input)) {
      console.log(action.ephemeral ? `(private) ${action.content}` : action.content);
    }
  } catch (error) {
    if (!(error instanceof PluginCallError)) throw error;
    console.error(`✘ plugin ${error.reason}: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await plugin.instance.close();
  }
}

async function schema(output = 'plugins/sdk/schema.json') {
  const json = (schema: z.ZodType) =>
    z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  const contract = {
    $comment: 'Generated by pnpm plugin schema. Do not edit.',
    manifest: json(manifestSchema),
    handleCommand: { input: json(commandInputSchema), output: json(commandOutputSchema) },
    autocomplete: { input: json(commandInputSchema), output: json(choicesSchema) },
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
  options: { user: { type: 'string' }, guild: { type: 'string' }, locale: { type: 'string' } },
});
const [action, file, ...words] = positionals;
try {
  if (action === 'check' && file) await check(file);
  else if (action === 'run' && file) await run(file, words, flags);
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

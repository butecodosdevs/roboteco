import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import {
  ApplicationCommandOptionType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import { eq } from 'drizzle-orm';
import '@/app.module';
import { closeCache } from '@/cache';
import { Command, Subcommand, SubcommandGroup } from '@/core';
import { CommandHandler } from '@/core/command';
import { closeDb, db, getGuildSettings, schema } from '@/db';
import { ModerationCommand } from '@/modules/moderation/commands/moderation/moderation.command';
import { uniqueGuildId } from '../plugins/fakes';

const created: string[] = [];

after(async () => {
  for (const id of created) await db.delete(schema.guilds).where(eq(schema.guilds.id, id));
  await closeDb();
  await closeCache();
});

/** A /moderation call by an administrator, with only the fields the handlers read. */
function call(
  route: { group?: string; subcommand: string },
  values: Record<string, unknown> = {},
  userId = '200000000000000300',
) {
  const guildId = uniqueGuildId();
  created.push(guildId);
  const replies: unknown[] = [];
  const interaction = {
    inCachedGuild: () => true,
    guildId,
    guild: { id: guildId, preferredLocale: 'en-US', members: { me: null } },
    user: { id: userId },
    locale: 'en-US',
    memberPermissions: { has: () => true },
    options: {
      getSubcommandGroup: () => route.group ?? null,
      getSubcommand: () => route.subcommand,
      getString: (name: string) => values[name] ?? null,
      getBoolean: (name: string) => values[name] ?? null,
      getChannel: (name: string) => values[name] ?? null,
    },
    reply: async (payload: unknown) => replies.push(payload),
  };
  return { interaction: interaction as never, replies, guildId };
}

const moderation = new CommandHandler(ModerationCommand);

test('/moderation log toggle reaches the server log handler and saves the change', async () => {
  const { interaction, guildId } = call(
    { group: 'log', subcommand: 'toggle' },
    { event: 'messageDelete', enabled: false },
  );
  await moderation.handle(interaction);
  const settings = await getGuildSettings(guildId);
  assert.deepEqual(settings?.serverLogDisabledEvents, ['messageDelete']);
});

test('/moderation log cases and /moderation log server set different channels', async () => {
  const channel = { id: '400000000000000300', toString: () => '<#400000000000000300>' };
  const cases = call({ group: 'log', subcommand: 'cases' }, { channel });
  await moderation.handle(cases.interaction);
  const server = call({ group: 'log', subcommand: 'server' }, { channel });
  await moderation.handle(server.interaction);

  const afterCases = await getGuildSettings(cases.guildId);
  assert.equal(afterCases?.moderationLogChannelId, channel.id);
  assert.equal(afterCases?.serverLogChannelId ?? null, null);
  const afterServer = await getGuildSettings(server.guildId);
  assert.equal(afterServer?.serverLogChannelId, channel.id);
  assert.equal(afterServer?.moderationLogChannelId ?? null, null);
});

test('a plain subcommand next to a group still routes by its own name', async () => {
  const { interaction, guildId } = call({ subcommand: 'dm' }, { enabled: false });
  await moderation.handle(interaction);
  assert.equal((await getGuildSettings(guildId))?.moderationDmUsers, false);
});

test('an unknown group or subcommand fails with the route it was given', async () => {
  for (const route of [
    { group: 'nope', subcommand: 'toggle' },
    { group: 'log', subcommand: 'nope' },
    { subcommand: 'toggle' },
  ]) {
    const name = ['/moderation', route.group, route.subcommand].filter(Boolean).join(' ');
    await assert.rejects(async () => moderation.handle(call(route).interaction), {
      message: `No handler for ${name}`,
    });
  }
});

test('groups are sent to Discord with their subcommands nested inside', () => {
  const json = moderation.toJSON();
  const group = json.options?.find((o) => o.name === 'log');
  assert.equal(group?.type, ApplicationCommandOptionType.SubcommandGroup);
  assert.deepEqual(
    group && 'options' in group ? group.options?.map((o) => [o.name, o.type]) : [],
    ['cases', 'server', 'toggle', 'ignore', 'unignore', 'status'].map((name) => [
      name,
      ApplicationCommandOptionType.Subcommand,
    ]),
  );
  const cases = group && 'options' in group ? group.options?.[0] : undefined;
  assert.deepEqual(
    cases && 'options' in cases ? cases.options?.map((o) => o.name) : [],
    ['channel'],
    'a subcommand inside a group keeps its own options',
  );
});

// A command defined only here, to test cooldowns and limits without touching real ones. The
// decorators are applied as plain calls so these stay local to the test.
let runs: string[] = [];
const context = {} as ClassDecoratorContext;
const decorate = <T extends abstract new (...args: never[]) => unknown>(
  decorator: (target: never, context: ClassDecoratorContext) => void,
  target: T,
) => {
  decorator(target as never, context);
  return target;
};
const subcommand = (name: string, cooldown = 0) =>
  decorate(
    Subcommand(new SlashCommandSubcommandBuilder().setName(name).setDescription(name), {
      cooldown,
    }),
    class {
      async execute() {
        runs.push(name);
      }
    },
  );
const group = (name: string, subcommands: ReturnType<typeof subcommand>[]) =>
  decorate(
    SubcommandGroup(new SlashCommandSubcommandGroupBuilder().setName(name).setDescription(name), {
      subcommands,
    }),
    class {},
  );
const command = (name: string, groups: ReturnType<typeof group>[]) =>
  decorate(
    Command({ data: new SlashCommandBuilder().setName(name).setDescription(name), groups }),
    class {},
  );

const CooledCommand = command('cooled', [
  group('pair', [subcommand('one', 30), subcommand('two', 30)]),
]);

test('cooldowns are per subcommand inside a group', async () => {
  runs = [];
  const handler = new CommandHandler(CooledCommand);
  const replies: unknown[] = [];
  const use = (subcommand: string) =>
    handler.handle({
      user: { id: '200000000000000301' },
      locale: 'en-US',
      options: { getSubcommandGroup: () => 'pair', getSubcommand: () => subcommand },
      reply: async (payload: unknown) => replies.push(payload),
    } as never);

  await use('one');
  await use('one');
  await use('two');
  assert.deepEqual(runs, ['one', 'two'], 'the second /cooled pair one waits; two has its own');
  assert.equal(replies.length, 1, 'the refused call is told to wait');
});

test("Discord's limit of 25 subcommands per group is checked at startup", () => {
  const many = Array.from({ length: 26 }, (_, i) => subcommand(`s${i}`));
  const big = command('big', [group('big', many)]);
  assert.throws(() => new CommandHandler(big), /more than 25 subcommands/);
});

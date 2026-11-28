import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { MessageFlags, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { eq } from 'drizzle-orm';
import '@/app.module';
import { closeCache } from '@/cache';
import { CommandHandler } from '@/core/command';
import { ContextMenuHandler } from '@/core/context-menu';
import { closeDb, db, getGuildSettings, schema } from '@/db';
import { CustomcommandCommand } from '@/modules/custom-commands/commands/customcommand/customcommand.command';
import { EmbedsCommand } from '@/modules/embeds/commands/embeds/embeds.command';
import { BanCommand } from '@/modules/moderation/commands/ban/ban.command';
import { TimeoutContextMenu } from '@/modules/moderation/context-menus/timeout.context-menu';
import { PingCommand } from '@/modules/ping/commands/ping/ping.command';
import { fakeServer } from '../plugins/fakes';

// Server admins can open a staff command to anyone in Integrations; these open them that way by
// handing the command to members who lack its default permission.
const created: string[] = [];

after(async () => {
  for (const guildId of created) {
    await db.delete(schema.moderationCases).where(eq(schema.moderationCases.guildId, guildId));
    await db.delete(schema.customCommands).where(eq(schema.customCommands.guildId, guildId));
    await db.delete(schema.guilds).where(eq(schema.guilds.id, guildId));
  }
  await closeDb();
  await closeCache();
});

type Server = ReturnType<typeof fakeServer>;

async function slash(
  s: Server,
  userId: string,
  options: {
    subcommand?: string;
    users?: Record<string, string>;
    booleans?: Record<string, boolean>;
  },
) {
  const member = await s.guild.members.fetch(userId);
  const replies: { content: string; flags?: number }[] = [];
  const interaction = {
    inCachedGuild: () => true,
    inGuild: () => true,
    guild: s.guild,
    guildId: s.guild.id,
    member,
    user: member.user,
    client: s.guild.client,
    locale: 'en-US',
    memberPermissions: member.permissions,
    options: {
      getSubcommand: () => options.subcommand ?? null,
      getUser: (name: string) => {
        const id = options.users?.[name];
        return id ? { id, toString: () => `<@${id}>`, send: async () => undefined } : null;
      },
      getString: () => null,
      getBoolean: (name: string) => options.booleans?.[name] ?? null,
      getFocused: () => '',
    },
    reply: async (payload: any) =>
      replies.push(typeof payload === 'string' ? { content: payload } : payload),
    deferReply: async () => undefined,
    editReply: async (payload: any) =>
      replies.push(typeof payload === 'string' ? { content: payload } : payload),
    respond: async (choices: unknown[]) => replies.push({ content: JSON.stringify(choices) }),
  };
  return { interaction: interaction as never, replies };
}

function server() {
  const s = fakeServer();
  created.push(s.guild.id);
  return s;
}

test('/ban opened to a member without Ban Members refuses them and bans no one', async () => {
  const s = server();
  s.role('300000000000000200', 20, [PermissionFlagsBits.SendMessages]);
  s.member('200000000000000200', ['300000000000000200']);
  s.member('200000000000000201');
  const { interaction, replies } = await slash(s, '200000000000000200', {
    users: { user: '200000000000000201' },
  });
  await new CommandHandler(BanCommand).handle(interaction);

  assert.equal(s.bans.size, 0);
  const rows = await db
    .select()
    .from(schema.moderationCases)
    .where(eq(schema.moderationCases.guildId, s.guild.id));
  assert.equal(rows.length, 0);
  assert.equal(replies.length, 1);
  assert.equal(replies[0]?.flags, MessageFlags.Ephemeral);
  assert.match(replies[0]?.content ?? '', /BanMembers/);
});

test('/ban still works for a member with Ban Members, and for an administrator', async () => {
  for (const permission of [PermissionFlagsBits.BanMembers, PermissionFlagsBits.Administrator]) {
    const s = server();
    s.role('300000000000000210', 20, [permission]);
    s.member('200000000000000210', ['300000000000000210']);
    s.member('200000000000000211');
    const { interaction } = await slash(s, '200000000000000210', {
      users: { user: '200000000000000211' },
    });
    await new CommandHandler(BanCommand).handle(interaction);
    assert.deepEqual(
      [...s.bans],
      ['200000000000000211'],
      new PermissionsBitField(permission).toArray()[0],
    );
  }
});

test('/embeds toggle opened to a member without Manage Server saves nothing', async () => {
  const s = server();
  s.member('200000000000000220');
  const { interaction, replies } = await slash(s, '200000000000000220', {
    subcommand: 'toggle',
    booleans: { enabled: true },
  });
  await new CommandHandler(EmbedsCommand).handle(interaction);

  assert.equal((await getGuildSettings(s.guild.id))?.embedsEnabled ?? false, false);
  assert.match(replies[0]?.content ?? '', /ManageGuild/);
});

test('autocomplete gives a member without the permission no suggestions', async () => {
  const s = server();
  s.member('200000000000000230');
  await db.insert(schema.customCommands).values({
    guildId: s.guild.id,
    name: 'rules',
    response: 'Be nice.',
    description: 'The rules',
    createdBy: '200000000000000230',
  });
  const { interaction, replies } = await slash(s, '200000000000000230', { subcommand: 'remove' });
  await new CommandHandler(CustomcommandCommand).autocomplete(interaction);
  assert.deepEqual(replies, [{ content: '[]' }], 'no custom command names leak');

  s.role('300000000000000230', 20, [PermissionFlagsBits.ManageGuild]);
  s.member('200000000000000231', ['300000000000000230']);
  const staff = await slash(s, '200000000000000231', { subcommand: 'remove' });
  await new CommandHandler(CustomcommandCommand).autocomplete(staff.interaction);
  assert.deepEqual(staff.replies, [
    { content: JSON.stringify([{ name: 'rules', value: 'rules' }]) },
  ]);
});

test('the Timeout menu is refused the same way, before its form opens', async () => {
  const s = server();
  s.member('200000000000000240');
  s.member('200000000000000241');
  const member = await s.guild.members.fetch('200000000000000240');
  const shown: unknown[] = [];
  const replies: { content: string }[] = [];
  const interaction = {
    inCachedGuild: () => true,
    user: member.user,
    locale: 'en-US',
    memberPermissions: member.permissions,
    targetUser: (await s.guild.members.fetch('200000000000000241')).user,
    reply: async (payload: { content: string }) => replies.push(payload),
    showModal: async (modal: unknown) => shown.push(modal),
  };
  await new ContextMenuHandler(TimeoutContextMenu).handle(interaction as never);
  assert.equal(shown.length, 0);
  assert.match(replies[0]?.content ?? '', /ModerateMembers/);

  s.role('300000000000000240', 20, [PermissionFlagsBits.ModerateMembers]);
  const moderator = s.member('200000000000000242', ['300000000000000240']);
  await new ContextMenuHandler(TimeoutContextMenu).handle({
    ...interaction,
    user: moderator.user,
    memberPermissions: moderator.permissions,
  } as never);
  assert.equal(shown.length, 1);
});

test('a command without a default permission still works for everyone', async () => {
  const s = server();
  s.member('200000000000000250');
  const { interaction, replies } = await slash(s, '200000000000000250', {});
  Object.assign(interaction, { client: { ws: { ping: 1 } } });
  await new CommandHandler(PingCommand).handle(interaction);
  // /ping answers, then edits in the latency: both only happen when the handler ran.
  assert.equal(replies.length, 2);
});

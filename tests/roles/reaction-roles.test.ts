import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { PermissionFlagsBits } from 'discord.js';
import { eq } from 'drizzle-orm';
import '@/app.module';
import { closeCache } from '@/cache';
import { inject } from '@/core';
import { CommandHandler } from '@/core/command';
import { closeDb, db, schema } from '@/db';
import { ReactionrolesCommand } from '@/modules/roles/commands/reactionroles/reactionroles.command';
import { RolesCommand } from '@/modules/roles/commands/roles/roles.command';
import { MessageDeleteEvent } from '@/modules/roles/events/message-delete.event';
import { MessageReactionAddEvent } from '@/modules/roles/events/message-reaction-add.event';
import { MessageReactionRemoveEvent } from '@/modules/roles/events/message-reaction-remove.event';
import { ReactionRolesService } from '@/modules/roles/reaction-roles.service';
import { fakeServer } from '../plugins/fakes';

const created: string[] = [];
const channelId = '400000000000000900';
const messageId = '600000000000000900';

after(async () => {
  for (const guildId of created) {
    await db.delete(schema.reactionRoles).where(eq(schema.reactionRoles.guildId, guildId));
    await db.delete(schema.selfRoles).where(eq(schema.selfRoles.guildId, guildId));
    await db.delete(schema.guilds).where(eq(schema.guilds.id, guildId));
  }
  await closeDb();
  await closeCache();
});

/** A server with a mod (Manage Roles, rank 30), a member, a message, and the roles to link. */
function setup() {
  const s = fakeServer();
  created.push(s.guild.id);
  s.role('300000000000000901', 30, [PermissionFlagsBits.ManageRoles]);
  s.role('300000000000000902', 10, []);
  s.role('300000000000000903', 40, []);
  s.role('300000000000000904', 5, [PermissionFlagsBits.BanMembers]);
  s.member('200000000000000901', ['300000000000000901']);
  s.member('200000000000000902');
  const reacted: string[] = [];
  const channel = s.channel(channelId);
  channel.messages.fetch = async (id: string) =>
    id === messageId
      ? {
          id,
          channelId,
          channel,
          url: `https://discord.com/channels/${s.guild.id}/${channelId}/${id}`,
          react: async (emoji: string) => reacted.push(emoji),
        }
      : Promise.reject(new Error('Unknown Message'));
  return { s, reacted };
}

async function run(
  s: ReturnType<typeof fakeServer>,
  command: object,
  sub: string,
  options: Record<string, string>,
) {
  const member = await s.guild.members.fetch('200000000000000901');
  const replies: string[] = [];
  await new CommandHandler(command as never).handle({
    inCachedGuild: () => true,
    guild: s.guild,
    guildId: s.guild.id,
    channelId,
    member,
    user: member.user,
    client: s.guild.client,
    locale: 'en-US',
    memberPermissions: member.permissions,
    options: {
      getSubcommandGroup: () => null,
      getSubcommand: () => sub,
      getString: (name: string) => options[name] ?? null,
      getChannel: () => null,
      getRole: (name: string) => (options[name] ? s.guild.roles.cache.get(options[name]) : null),
    },
    deferReply: async () => undefined,
    editReply: async (p: { content: string }) => replies.push(p.content),
    reply: async (p: { content: string }) => replies.push(p.content),
  } as never);
  return replies;
}

const reaction = (s: ReturnType<typeof fakeServer>, name: string) => ({
  message: { id: messageId, guild: s.guild },
  emoji: { id: null, name },
});
const member = { id: '200000000000000902', bot: false };

test('setup links roles below the caller; reacting gives the role and unreacting takes it', async () => {
  const { s, reacted } = setup();
  await run(s, ReactionrolesCommand, 'setup', {
    message: messageId,
    roles: '🎮 <@&300000000000000902>',
  });
  const rows = await db
    .select()
    .from(schema.reactionRoles)
    .where(eq(schema.reactionRoles.guildId, s.guild.id));
  assert.deepEqual(
    rows.map((r) => [r.emoji, r.roleId]),
    [['🎮', '300000000000000902']],
  );
  assert.deepEqual(reacted, ['🎮']);

  await new MessageReactionAddEvent().execute(
    reaction(s, '🎮') as never,
    member as never,
    {} as never,
  );
  await new MessageReactionAddEvent().execute(
    reaction(s, '🎨') as never,
    member as never,
    {} as never,
  );
  await new MessageReactionAddEvent().execute(
    reaction(s, '🎮') as never,
    { id: '200000000000000903', bot: true } as never,
    {} as never,
  );
  await new MessageReactionRemoveEvent().execute(
    reaction(s, '🎮') as never,
    member as never,
    {} as never,
  );
  assert.deepEqual(s.roleChanges, [
    '+300000000000000902:200000000000000902',
    '-300000000000000902:200000000000000902',
  ]);
});

test("setup refuses a role at or above the caller's highest role, and staff roles", async () => {
  const { s, reacted } = setup();
  await run(s, ReactionrolesCommand, 'setup', {
    message: messageId,
    roles: '🎮 300000000000000903 🔨 300000000000000904',
  });
  const rows = await db
    .select()
    .from(schema.reactionRoles)
    .where(eq(schema.reactionRoles.guildId, s.guild.id));
  assert.equal(rows.length, 0);
  assert.deepEqual(reacted, []);
});

test('a linked role that later gains staff permissions is no longer handed out', async () => {
  const { s } = setup();
  await run(s, ReactionrolesCommand, 'setup', {
    message: messageId,
    roles: '🎮 300000000000000902',
  });
  s.guild.roles.cache.get('300000000000000902').permissions.add(PermissionFlagsBits.KickMembers);
  await new MessageReactionAddEvent().execute(
    reaction(s, '🎮') as never,
    member as never,
    {} as never,
  );
  assert.deepEqual(s.roleChanges, []);
});

test('deleting the message removes its links, and links survive a reload', async () => {
  const { s } = setup();
  await run(s, ReactionrolesCommand, 'setup', {
    message: messageId,
    roles: '🎮 300000000000000902',
  });
  const service = inject(ReactionRolesService);
  await service.load();
  assert.equal(service.roleFor(messageId, '🎮'), '300000000000000902');
  await new MessageDeleteEvent().execute({ id: messageId } as never);
  const rows = await db
    .select()
    .from(schema.reactionRoles)
    .where(eq(schema.reactionRoles.messageId, messageId));
  assert.equal(rows.length, 0);
  assert.equal(service.roleFor(messageId, '🎮'), undefined);
});

test('/roles add refuses a role above the caller, so a mod cannot make it self-assignable', async () => {
  const { s } = setup();
  await run(s, RolesCommand, 'add', { role: '300000000000000903' });
  const rows = await db
    .select()
    .from(schema.selfRoles)
    .where(eq(schema.selfRoles.guildId, s.guild.id));
  assert.equal(rows.length, 0);
});

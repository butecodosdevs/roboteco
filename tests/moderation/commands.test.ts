import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { PermissionFlagsBits } from 'discord.js';
import { eq } from 'drizzle-orm';
import '@/app.module';
import { closeCache } from '@/cache';
import { CommandHandler } from '@/core/command';
import { closeDb, db, schema } from '@/db';
import { BanCommand } from '@/modules/moderation/commands/ban/ban.command';
import { WarnCommand } from '@/modules/moderation/commands/warn/warn.command';
import { fakeServer } from '../plugins/fakes';

const created: string[] = [];

after(async () => {
  for (const guildId of created) {
    await db.delete(schema.moderationCases).where(eq(schema.moderationCases.guildId, guildId));
    await db.delete(schema.guilds).where(eq(schema.guilds.id, guildId));
  }
  await closeDb();
  await closeCache();
});

/** A /command interaction from `moderatorId` with the given options. */
function interaction(
  s: ReturnType<typeof fakeServer>,
  moderatorId: string,
  options: Record<string, unknown>,
) {
  const replies: string[] = [];
  const moderator = s.guild.members.fetch(moderatorId);
  return {
    replies,
    value: moderator.then((member: any) => ({
      inCachedGuild: () => true,
      guild: s.guild,
      guildId: s.guild.id,
      member,
      user: member.user,
      client: s.guild.client,
      locale: 'en-US',
      memberPermissions: member.permissions,
      options: {
        getSubcommand: () => null,
        getUser: (name: string) =>
          options[name]
            ? {
                id: options[name],
                toString: () => `<@${options[name]}>`,
                send: async () => undefined,
              }
            : null,
        getString: (name: string) => (options[name] as string | undefined) ?? null,
      },
      deferReply: async () => undefined,
      editReply: async (content: string) => replies.push(content),
    })),
  };
}

test('/warn records a case with the moderator, through the shared perform()', async () => {
  const s = fakeServer();
  created.push(s.guild.id);
  s.role('300000000000000100', 10, [PermissionFlagsBits.ModerateMembers]);
  s.member('200000000000000100', ['300000000000000100']);
  s.member('200000000000000101');
  const call = interaction(s, '200000000000000100', { user: '200000000000000101', reason: 'rude' });
  await new CommandHandler(WarnCommand).handle((await call.value) as never);
  const [entry] = await db
    .select()
    .from(schema.moderationCases)
    .where(eq(schema.moderationCases.guildId, s.guild.id));
  assert.equal(entry?.action, 'warn');
  assert.equal(entry?.moderatorId, '200000000000000100');
  assert.equal(entry?.reason, 'rude');
  assert.equal(call.replies.length, 1);
});

test('/ban refuses a target ranked above the moderator and bans nobody', async () => {
  const s = fakeServer();
  created.push(s.guild.id);
  s.role('300000000000000110', 10, [PermissionFlagsBits.BanMembers]);
  s.role('300000000000000111', 20, []);
  s.member('200000000000000110', ['300000000000000110']);
  s.member('200000000000000111', ['300000000000000111']);
  const call = interaction(s, '200000000000000110', { user: '200000000000000111' });
  await new CommandHandler(BanCommand).handle((await call.value) as never);
  assert.equal(s.bans.size, 0);
  const rows = await db
    .select()
    .from(schema.moderationCases)
    .where(eq(schema.moderationCases.guildId, s.guild.id));
  assert.equal(rows.length, 0);
});

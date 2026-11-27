import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command, type GuildInteraction, inject, schedule } from '@/core';
import { defaultLocale, localizations, localize, t } from '@/i18n';
import { relativeTime } from '@/lib/duration';
import { type BanDuration, banDurationKeys, banDurations } from '../../cases.service';
import { UnbanJob } from '../../jobs/unban.job';
import { ModerationService } from '../../moderation.service';
import { TempBansService } from '../../temp-bans.service';
import { type DeleteWindow, deleteWindowKeys, deleteWindows } from './delete-windows';

@Command({
  data: localize(new SlashCommandBuilder(), 'moderation.commands.ban')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) => localize(opt, 'moderation.options.user').setRequired(true))
    .addStringOption((opt) => localize(opt, 'moderation.options.reason').setMaxLength(400))
    .addStringOption((opt) =>
      localize(opt, 'moderation.options.deleteMessages').addChoices(
        ...deleteWindowKeys.map((key) => ({
          name: t(defaultLocale, `moderation.deleteWindows.${key}`),
          name_localizations: localizations(`moderation.deleteWindows.${key}`),
          value: key,
        })),
      ),
    )
    .addStringOption((opt) =>
      localize(opt, 'moderation.options.banDuration').addChoices(
        ...banDurationKeys.map((key) => ({
          name: t(defaultLocale, `moderation.banDurations.${key}`),
          name_localizations: localizations(`moderation.banDurations.${key}`),
          value: key,
        })),
      ),
    ),
  guildOnly: true,
})
export class BanCommand {
  private readonly moderation = inject(ModerationService);
  private readonly tempBans = inject(TempBansService);

  execute(interaction: GuildInteraction) {
    const target = interaction.options.getUser('user', true);
    const window = (interaction.options.getString('delete_messages') ?? 'none') as DeleteWindow;
    const durationKey = interaction.options.getString('duration') as BanDuration | null;
    const seconds = durationKey ? banDurations[durationKey] : undefined;
    return this.moderation.apply(interaction, {
      action: 'ban',
      target,
      reason: interaction.options.getString('reason'),
      durationSeconds: seconds,
      check: async () => {
        const banned = await interaction.guild.bans.fetch(target.id).catch(() => null);
        return banned
          ? { key: 'moderation.errors.alreadyBanned', vars: { user: target.toString() } }
          : undefined;
      },
      run: ({ auditReason }) =>
        interaction.guild.members.ban(target, {
          reason: auditReason,
          deleteMessageSeconds: deleteWindows[window],
        }),
      onApplied: async () => {
        if (!seconds) return undefined;
        const expiresAt = new Date(Date.now() + seconds * 1000);
        const jobId = await schedule(UnbanJob, expiresAt, {
          guildId: interaction.guildId,
          userId: target.id,
        });
        await this.tempBans.add(interaction.guildId, target.id, jobId, expiresAt);
        return t(interaction.locale, 'moderation.tempBan.until', { when: relativeTime(expiresAt) });
      },
    });
  }
}

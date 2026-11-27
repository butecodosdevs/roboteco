import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command, type GuildInteraction, inject } from '@/core';
import { defaultLocale, localizations, localize, t } from '@/i18n';
import { type TimeoutDuration, timeoutDurationKeys, timeoutDurations } from '../../cases.service';
import { ModerationService } from '../../moderation.service';

@Command({
  data: localize(new SlashCommandBuilder(), 'moderation.commands.timeout')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => localize(opt, 'moderation.options.user').setRequired(true))
    .addStringOption((opt) =>
      localize(opt, 'moderation.options.duration')
        .setRequired(true)
        .addChoices(
          ...timeoutDurationKeys.map((key) => ({
            name: t(defaultLocale, `moderation.durations.${key}`),
            name_localizations: localizations(`moderation.durations.${key}`),
            value: key,
          })),
        ),
    )
    .addStringOption((opt) => localize(opt, 'moderation.options.reason').setMaxLength(400)),
  guildOnly: true,
})
export class TimeoutCommand {
  private readonly moderation = inject(ModerationService);

  execute(interaction: GuildInteraction) {
    const target = interaction.options.getUser('user', true);
    const seconds =
      timeoutDurations[interaction.options.getString('duration', true) as TimeoutDuration];
    return this.moderation.apply(interaction, {
      action: 'timeout',
      target,
      reason: interaction.options.getString('reason'),
      durationSeconds: seconds,
      requireMember: true,
      check: (member) =>
        member?.moderatable
          ? undefined
          : { key: 'moderation.errors.cannotTimeout', vars: { user: target.toString() } },
      run: async ({ member, auditReason }) => {
        await member?.timeout(seconds * 1000, auditReason);
      },
    });
  }
}

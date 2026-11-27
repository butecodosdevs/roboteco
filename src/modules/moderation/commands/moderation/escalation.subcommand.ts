import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { defaultLocale, localizations, localize, t, translator } from '@/i18n';
import { parseDuration } from '@/lib/duration';
import { ModerationSettingsService } from '../../moderation-settings.service';

const actions = ['timeout', 'kick', 'ban'] as const;

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'moderation.commands.settingsEscalation')
    .addIntegerOption((opt) =>
      localize(opt, 'moderation.options.escalationWarnings')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(20),
    )
    .addStringOption((opt) =>
      localize(opt, 'moderation.options.escalationAction').addChoices(
        ...actions.map((action) => ({
          name: t(defaultLocale, `moderation.actions.${action}`),
          name_localizations: localizations(`moderation.actions.${action}`),
          value: action,
        })),
      ),
    )
    .addStringOption((opt) =>
      localize(opt, 'moderation.options.escalationDuration').setMaxLength(20),
    ),
)
export class EscalationSubcommand {
  private readonly settings = inject(ModerationSettingsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    const warnings = interaction.options.getInteger('warnings', true);
    const action = (interaction.options.getString('action') ??
      'timeout') as (typeof actions)[number];
    const durationText = interaction.options.getString('duration');
    const duration = durationText ? parseDuration(durationText, { max: 28 * 86_400 }) : 3600;
    if (!duration) return reply(tr('moderation.errors.invalidDuration'));

    await this.settings.update(interaction.guildId, interaction.guild.preferredLocale, {
      escalationWarnings: warnings || null,
      escalationAction: warnings ? action : null,
      escalationDurationSeconds: warnings && action === 'timeout' ? duration : null,
    });
    return reply(
      warnings
        ? tr('moderation.replies.escalationSet', {
            count: warnings,
            action: tr(`moderation.actions.${action}`),
          })
        : tr('moderation.replies.escalationOff'),
    );
  }
}

import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { ModerationSettingsService } from '../../moderation-settings.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'moderation.commands.settingsStatus'))
export class StatusSubcommand {
  private readonly settings = inject(ModerationSettingsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const settings = await this.settings.get(interaction.guildId);
    const { logChannelId, dmUsers, escalationWarnings, escalationAction, warnExpiryDays } =
      settings;
    return interaction.reply({
      content: tr('moderation.replies.status', {
        channel: logChannelId ? `<#${logChannelId}>` : tr('moderation.replies.none'),
        dm: tr(dmUsers ? 'moderation.replies.yes' : 'moderation.replies.no'),
        escalation:
          escalationWarnings && escalationAction
            ? tr('moderation.escalation.status', {
                action: tr(`moderation.actions.${escalationAction}`),
                count: escalationWarnings,
              })
            : tr('moderation.escalation.off'),
        expiry: warnExpiryDays
          ? tr('moderation.replies.expiryDays', { days: warnExpiryDays })
          : tr('moderation.replies.forever'),
      }),
      flags: MessageFlags.Ephemeral,
    });
  }
}

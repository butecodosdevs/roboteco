import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { ModerationSettingsService } from '../../moderation-settings.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'moderation.commands.settingsDm').addBooleanOption(
    (opt) => localize(opt, 'moderation.options.dmEnabled').setRequired(true),
  ),
)
export class DmSubcommand {
  private readonly settings = inject(ModerationSettingsService);

  async execute(interaction: GuildInteraction) {
    const enabled = interaction.options.getBoolean('enabled', true);
    await this.settings.update(interaction.guildId, interaction.guild.preferredLocale, {
      dmUsers: enabled,
    });
    return interaction.reply({
      content: t(
        interaction.locale,
        enabled ? 'moderation.replies.dmOn' : 'moderation.replies.dmOff',
      ),
      flags: MessageFlags.Ephemeral,
    });
  }
}

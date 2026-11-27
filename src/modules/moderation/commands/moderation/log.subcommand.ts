import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { ModerationSettingsService } from '../../moderation-settings.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'moderation.commands.settingsLog').addChannelOption(
    (opt) => localize(opt, 'moderation.options.logChannel').addChannelTypes(ChannelType.GuildText),
  ),
)
export class LogSubcommand {
  private readonly settings = inject(ModerationSettingsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const channel = interaction.options.getChannel('channel', false, [ChannelType.GuildText]);
    await this.settings.update(interaction.guildId, interaction.guild.preferredLocale, {
      logChannelId: channel?.id ?? null,
    });
    return interaction.reply({
      content: channel
        ? tr('moderation.replies.logSet', { channel: channel.toString() })
        : tr('moderation.replies.logCleared'),
      flags: MessageFlags.Ephemeral,
    });
  }
}

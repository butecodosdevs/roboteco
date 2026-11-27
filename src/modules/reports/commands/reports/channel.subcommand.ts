import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, t } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'reports.channel').addChannelOption((opt) =>
    localize(opt, 'reports.options.channel')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true),
  ),
)
export class ChannelSubcommand {
  async execute(interaction: GuildInteraction) {
    const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      reportsChannelId: channel.id,
    });
    return interaction.reply({
      content: t(interaction.locale, 'reports.replies.channelSet', { channel: channel.toString() }),
      flags: MessageFlags.Ephemeral,
    });
  }
}

import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, t } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'starboard.channel')
    .addChannelOption((opt) =>
      localize(opt, 'starboard.options.channel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'starboard.options.threshold').setMinValue(1).setMaxValue(100),
    ),
)
export class ChannelSubcommand {
  async execute(interaction: GuildInteraction) {
    const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);
    const threshold = interaction.options.getInteger('threshold') ?? 3;
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      starboardChannelId: channel.id,
      starboardThreshold: threshold,
    });
    return interaction.reply({
      content: t(interaction.locale, 'starboard.replies.set', {
        threshold,
        channel: channel.toString(),
      }),
      flags: MessageFlags.Ephemeral,
    });
  }
}

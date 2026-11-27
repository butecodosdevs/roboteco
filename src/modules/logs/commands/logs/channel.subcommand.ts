import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { config } from '@/config';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'logs.channel').addChannelOption((opt) =>
    localize(opt, 'logs.options.channel').addChannelTypes(ChannelType.GuildText),
  ),
)
export class ChannelSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const channel = interaction.options.getChannel('channel', false, [ChannelType.GuildText]);
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      serverLogChannelId: channel?.id ?? null,
    });
    const lines = [
      channel
        ? tr('logs.replies.channelSet', { channel: channel.toString() })
        : tr('logs.replies.channelCleared'),
    ];
    if (channel && !config.privilegedIntents) lines.push(tr('logs.replies.intentDisabled'));
    return interaction.reply({
      content: lines.join('\n'),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

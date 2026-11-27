import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { config } from '@/config';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'welcome.channel').addChannelOption((opt) =>
    localize(opt, 'welcome.options.channel').addChannelTypes(ChannelType.GuildText),
  ),
)
export class ChannelSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const channel = interaction.options.getChannel('channel', false, [ChannelType.GuildText]);
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      welcomeChannelId: channel?.id ?? null,
    });
    const content = channel
      ? tr('welcome.replies.channelSet', { channel: channel.toString() })
      : tr('welcome.replies.channelCleared');
    const lines = [content];
    if (!config.privilegedIntents) lines.push(tr('welcome.replies.intentDisabled'));
    return interaction.reply({
      content: lines.join('\n'),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

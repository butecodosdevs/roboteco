import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { getGuildSettings, updateGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'embeds.ignore').addChannelOption((opt) =>
    localize(opt, 'embeds.options.ignoreChannel').setRequired(true),
  ),
)
export class IgnoreSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const channel = interaction.options.getChannel('channel', true);

    const settings = await getGuildSettings(interaction.guildId);
    const ignored = new Set(settings?.embedsIgnoredChannels ?? []);
    if (ignored.has(channel.id)) {
      return interaction.reply({
        content: tr('embeds.replies.alreadyIgnored', { channel: channel.toString() }),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    }
    ignored.add(channel.id);
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      embedsIgnoredChannels: [...ignored],
    });
    return interaction.reply({
      content: tr('embeds.replies.ignored', { channel: channel.toString() }),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

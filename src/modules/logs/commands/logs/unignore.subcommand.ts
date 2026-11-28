import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { getGuildSettings, updateGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'logs.unignore').addChannelOption((opt) =>
    localize(opt, 'logs.options.ignoreChannel').setRequired(true),
  ),
)
export class UnignoreSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const channel = interaction.options.getChannel('channel', true);

    const settings = await getGuildSettings(interaction.guildId);
    const ignored = new Set(settings?.serverLogIgnoredChannels ?? []);
    if (!ignored.has(channel.id)) {
      return interaction.reply({
        content: tr('logs.replies.notIgnored', { channel: channel.toString() }),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    }
    ignored.delete(channel.id);
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      serverLogIgnoredChannels: [...ignored],
    });
    return interaction.reply({
      content: tr('logs.replies.unignored', { channel: channel.toString() }),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

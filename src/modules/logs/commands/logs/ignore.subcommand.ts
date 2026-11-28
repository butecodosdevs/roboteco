import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { getGuildSettings, updateGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';
import { maxIgnoredChannels } from '../../logs.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'logs.ignore').addChannelOption((opt) =>
    localize(opt, 'logs.options.ignoreChannel').setRequired(true),
  ),
)
export class IgnoreSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const channel = interaction.options.getChannel('channel', true);

    const settings = await getGuildSettings(interaction.guildId);
    const ignored = new Set(settings?.serverLogIgnoredChannels ?? []);
    if (ignored.has(channel.id)) {
      return interaction.reply({
        content: tr('logs.replies.alreadyIgnored', { channel: channel.toString() }),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    }
    if (ignored.size >= maxIgnoredChannels) {
      return interaction.reply({
        content: tr('logs.replies.ignoreFull', { max: maxIgnoredChannels }),
        flags: MessageFlags.Ephemeral,
      });
    }
    ignored.add(channel.id);
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      serverLogIgnoredChannels: [...ignored],
    });
    return interaction.reply({
      content: tr('logs.replies.ignored', { channel: channel.toString() }),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

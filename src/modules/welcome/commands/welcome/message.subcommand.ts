import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'welcome.message').addStringOption((opt) =>
    localize(opt, 'welcome.options.text').setMaxLength(1500),
  ),
)
export class MessageSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const text = interaction.options.getString('text');
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      welcomeMessage: text,
    });
    return interaction.reply({
      content: tr(text ? 'welcome.replies.messageSet' : 'welcome.replies.messageReset'),
      flags: MessageFlags.Ephemeral,
    });
  }
}

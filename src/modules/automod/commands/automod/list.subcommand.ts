import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'automod.list'))
export class ListSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const rules = await interaction.guild.autoModerationRules.fetch();
    if (rules.size === 0)
      return interaction.reply({
        content: tr('automod.replies.none'),
        flags: MessageFlags.Ephemeral,
      });
    const embed = new EmbedBuilder()
      .setTitle(tr('automod.replies.listTitle'))
      .setDescription(rules.map((rule) => `${rule.enabled ? '🟢' : '⚪'} ${rule.name}`).join('\n'));
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

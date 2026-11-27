import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { DropsService } from '../../drops.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'drops.top'))
export class TopSubcommand {
  private readonly drops = inject(DropsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const rows = await this.drops.top(interaction.guildId);
    if (rows.length === 0) {
      return interaction.reply({
        content: tr('drops.replies.noClaims'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const embed = new EmbedBuilder().setTitle(tr('drops.replies.topTitle')).setDescription(
      rows
        .map((row, index) =>
          tr('drops.replies.topLine', {
            position: index + 1,
            user: `<@${row.userId}>`,
            claims: row.claims,
            xp: row.xp,
          }),
        )
        .join('\n'),
    );
    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
}

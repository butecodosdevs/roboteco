import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command, type GuildInteraction, inject } from '@/core';
import { localize, translator } from '@/i18n';
import { LevelsService, levelFor } from '../../levels.service';

@Command({ data: localize(new SlashCommandBuilder(), 'levels.leaderboard'), guildOnly: true })
export class LeaderboardCommand {
  private readonly levels = inject(LevelsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const top = await this.levels.top(interaction.guildId);
    if (top.length === 0) {
      return interaction.reply({
        content: tr('levels.replies.empty'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const lines = top.map((row, index) =>
      tr('levels.board.line', {
        position: index + 1,
        user: `<@${row.userId}>`,
        level: levelFor(row.xp).level,
        xp: row.xp,
      }),
    );
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(tr('levels.board.title'))
      .setDescription(lines.join('\n'));
    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
}

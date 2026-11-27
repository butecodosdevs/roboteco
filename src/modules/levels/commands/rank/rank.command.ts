import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command, type GuildInteraction, inject } from '@/core';
import { localize, translator } from '@/i18n';
import { LevelsService, levelFor } from '../../levels.service';

@Command({
  data: localize(new SlashCommandBuilder(), 'levels.rank').addUserOption((opt) =>
    localize(opt, 'levels.options.user'),
  ),
  guildOnly: true,
})
export class RankCommand {
  private readonly levels = inject(LevelsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const user = interaction.options.getUser('user') ?? interaction.user;
    const row = await this.levels.get(interaction.guildId, user.id);
    if (!row) {
      return interaction.reply({
        content: tr('levels.replies.noXp', { user: user.toString() }),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    }
    const { level, current, needed } = levelFor(row.xp);
    const position = await this.levels.position(interaction.guildId, row.xp);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .addFields(
        { name: tr('levels.card.level'), value: String(level), inline: true },
        { name: tr('levels.card.xp'), value: String(row.xp), inline: true },
        { name: tr('levels.card.rank'), value: `#${position}`, inline: true },
      )
      .setFooter({ text: tr('levels.card.progress', { current, needed, next: level + 1 }) });
    return interaction.reply({ embeds: [embed] });
  }
}

import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { BirthdaysService } from '../../birthdays.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'birthdays.upcoming'))
export class UpcomingSubcommand {
  private readonly birthdays = inject(BirthdaysService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const all = await this.birthdays.list(interaction.guildId);
    if (all.length === 0) {
      return interaction.reply({
        content: tr('birthdays.replies.none'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const now = new Date();
    const today = (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
    const key = (b: { month: number; day: number }) => {
      const value = b.month * 100 + b.day;
      return value >= today ? value : value + 1200;
    };
    const lines = all
      .sort((a, b) => key(a) - key(b))
      .slice(0, 15)
      .map((b) =>
        tr('birthdays.replies.line', {
          date: `${String(b.day).padStart(2, '0')}/${String(b.month).padStart(2, '0')}`,
          user: `<@${b.userId}>`,
        }),
      );
    const embed = new EmbedBuilder()
      .setTitle(tr('birthdays.replies.upcomingTitle'))
      .setDescription(lines.join('\n'));
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

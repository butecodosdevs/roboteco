import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { DropsService } from '../../drops.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'drops.list'))
export class ListSubcommand {
  private readonly drops = inject(DropsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const rows = this.drops.list(interaction.guildId);
    if (rows.length === 0)
      return interaction.reply({
        content: tr('drops.replies.none'),
        flags: MessageFlags.Ephemeral,
      });
    const embed = new EmbedBuilder().setTitle(tr('drops.replies.listTitle')).setDescription(
      (
        await Promise.all(
          rows.map(async (row) =>
            tr('drops.replies.line', {
              channel: `<#${row.channelId}>`,
              every: row.every,
              xp: row.xp,
              progress: await this.drops.progress(row.channelId),
            }),
          ),
        )
      ).join('\n'),
    );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

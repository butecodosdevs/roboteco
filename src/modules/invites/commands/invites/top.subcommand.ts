import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { InvitesService } from '../../invites.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'invites.top'))
export class TopSubcommand {
  private readonly invites = inject(InvitesService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const top = await this.invites.top(interaction.guildId);
    if (top.length === 0)
      return interaction.reply({
        content: tr('invites.replies.none'),
        flags: MessageFlags.Ephemeral,
      });
    const lines = top.map((row, index) =>
      tr('invites.replies.line', {
        position: index + 1,
        user: `<@${row.inviterId}>`,
        active: row.active,
        total: row.total,
      }),
    );
    const embed = new EmbedBuilder()
      .setTitle(tr('invites.replies.topTitle'))
      .setDescription(lines.join('\n'));
    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
}

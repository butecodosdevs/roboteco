import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command, type GuildInteraction, inject } from '@/core';
import { localize, translator } from '@/i18n';
import { CasesService } from '../../cases.service';

const shownCases = 10;

@Command({
  data: localize(new SlashCommandBuilder(), 'moderation.commands.history')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => localize(opt, 'moderation.options.historyUser').setRequired(true)),
  guildOnly: true,
})
export class HistoryCommand {
  private readonly cases = inject(CasesService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const user = interaction.options.getUser('user', true);
    const { cases, total } = await this.cases.forUser(interaction.guildId, user.id, shownCases);
    if (total === 0) {
      return interaction.reply({
        content: tr('moderation.replies.noHistory', { user: user.toString() }),
        flags: MessageFlags.Ephemeral,
      });
    }

    const lines = cases.map((entry) => {
      const when = `<t:${Math.floor(entry.createdAt.getTime() / 1000)}:R>`;
      const reason = entry.reason ?? tr('moderation.log.noReason');
      return `**#${entry.number}** · ${tr(`moderation.actions.${entry.action}`)} · ${when} · ${reason}`;
    });
    const embed = new EmbedBuilder()
      .setTitle(tr('moderation.log.historyTitle', { user: user.tag }))
      .setDescription(lines.join('\n'))
      .setFooter({ text: tr('moderation.log.historyFooter', { shown: cases.length, total }) });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

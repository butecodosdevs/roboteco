import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Button, type GuildButtonInteraction, inject } from '@/core';
import { t } from '@/i18n';
import { TicketsService } from '../tickets.service';

@Button('tickets.close')
export class CloseTicketButton {
  private readonly tickets = inject(TicketsService);

  async execute(interaction: GuildButtonInteraction, [id]: string[]) {
    const ticket = await this.tickets.get(interaction.guildId, Number(id));
    const thread = interaction.channel;
    if (!ticket || ticket.closedAt || !thread?.isThread()) return interaction.deferUpdate();

    const allowed =
      ticket.userId === interaction.user.id ||
      interaction.memberPermissions.has(PermissionFlagsBits.ManageThreads);
    if (!allowed) {
      return interaction.reply({
        content: t(interaction.locale, 'tickets.replies.notAllowed'),
        flags: MessageFlags.Ephemeral,
      });
    }

    await this.tickets.close(ticket.id);
    await interaction.update({ components: [] });
    await thread.send({
      content: t(interaction.guild.preferredLocale, 'tickets.thread.closed', {
        user: interaction.user.toString(),
      }),
      allowedMentions: { parse: [] },
    });
    await thread.setLocked(true);
    await thread.setArchived(true);
  }
}

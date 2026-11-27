import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { Button, customId, type GuildButtonInteraction, inject } from '@/core';
import { getGuildSettings } from '@/db';
import { t, translator } from '@/i18n';
import { TicketsService } from '../tickets.service';
import { CloseTicketButton } from './close-ticket.button';

@Button('tickets.open')
export class OpenTicketButton {
  private readonly tickets = inject(TicketsService);

  async execute(interaction: GuildButtonInteraction) {
    const tr = translator(interaction.locale);
    const { guild, channel, user } = interaction;
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });

    const existing = await this.tickets.openFor(guild.id, user.id);
    if (existing)
      return reply(tr('tickets.replies.alreadyOpen', { thread: `<#${existing.threadId}>` }));
    if (channel?.type !== ChannelType.GuildText) return reply(tr('tickets.replies.unsupported'));
    const me = guild.members.me;
    const canThread =
      me &&
      channel
        .permissionsFor(me)
        .has([
          PermissionFlagsBits.CreatePrivateThreads,
          PermissionFlagsBits.ManageThreads,
          PermissionFlagsBits.SendMessagesInThreads,
        ]);
    if (!canThread) return reply(tr('tickets.replies.botPermission'));

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const locale = guild.preferredLocale;
    const thread = await channel.threads.create({
      name: t(locale, 'tickets.thread.name', { user: user.username }).slice(0, 100),
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `Ticket for ${user.tag}`,
    });
    await thread.members.add(user.id);
    const ticket = await this.tickets.create(guild.id, user.id, thread.id);

    const staffRoleId = (await getGuildSettings(guild.id))?.ticketsStaffRoleId;
    await thread.send({
      content: t(locale, 'tickets.thread.welcome', {
        user: user.toString(),
        staff: staffRoleId ? `<@&${staffRoleId}>` : t(locale, 'tickets.thread.staffFallback'),
      }),
      allowedMentions: { users: [user.id], roles: staffRoleId ? [staffRoleId] : [] },
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(customId(CloseTicketButton, ticket.id))
            .setStyle(ButtonStyle.Danger)
            .setLabel(t(locale, 'tickets.thread.close')),
        ),
      ],
    });
    return interaction.editReply(tr('tickets.replies.opened', { thread: thread.toString() }));
  }
}

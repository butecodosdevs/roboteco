import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { PanelSubcommand } from './panel.subcommand';
import { StaffSubcommand } from './staff.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'tickets.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [PanelSubcommand, StaffSubcommand],
})
export class TicketsCommand {}

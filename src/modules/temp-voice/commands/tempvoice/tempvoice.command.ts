import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { ListSubcommand } from './list.subcommand';
import { RemoveSubcommand } from './remove.subcommand';
import { SetupSubcommand } from './setup.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'tempVoice.admin').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [SetupSubcommand, RemoveSubcommand, ListSubcommand],
})
export class TempvoiceCommand {}

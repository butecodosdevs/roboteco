import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { DisableSubcommand } from './disable.subcommand';
import { ListSubcommand } from './list.subcommand';
import { SetupSubcommand } from './setup.subcommand';
import { TopSubcommand } from './top.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'drops.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [SetupSubcommand, DisableSubcommand, ListSubcommand, TopSubcommand],
})
export class DropsCommand {}

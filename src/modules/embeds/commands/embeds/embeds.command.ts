import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { StatusSubcommand } from './status.subcommand';
import { ToggleSubcommand } from './toggle.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'embeds.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [ToggleSubcommand, StatusSubcommand],
})
export class EmbedsCommand {}

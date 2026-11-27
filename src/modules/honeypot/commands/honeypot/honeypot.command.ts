import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { DisableSubcommand } from './disable.subcommand';
import { SetSubcommand } from './set.subcommand';
import { StatusSubcommand } from './status.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'honeypot.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [SetSubcommand, DisableSubcommand, StatusSubcommand],
})
export class HoneypotCommand {}

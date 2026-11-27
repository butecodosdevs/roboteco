import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { SetupSubcommand } from './setup.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'verification.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [SetupSubcommand],
})
export class VerificationCommand {}

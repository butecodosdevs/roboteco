import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { ReasonSubcommand } from './reason.subcommand';
import { ViewSubcommand } from './view.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'moderation.commands.case').setDefaultMemberPermissions(
    PermissionFlagsBits.ModerateMembers,
  ),
  guildOnly: true,
  subcommands: [ViewSubcommand, ReasonSubcommand],
})
export class CaseCommand {}

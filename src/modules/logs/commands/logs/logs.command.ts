import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { ChannelSubcommand } from './channel.subcommand';
import { IgnoreSubcommand } from './ignore.subcommand';
import { StatusSubcommand } from './status.subcommand';
import { ToggleSubcommand } from './toggle.subcommand';
import { UnignoreSubcommand } from './unignore.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'logs.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [
    ChannelSubcommand,
    ToggleSubcommand,
    IgnoreSubcommand,
    UnignoreSubcommand,
    StatusSubcommand,
  ],
})
export class LogsCommand {}

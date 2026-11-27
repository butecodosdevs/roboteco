import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { IgnoreSubcommand } from './ignore.subcommand';
import { SiteSubcommand } from './site.subcommand';
import { StatusSubcommand } from './status.subcommand';
import { ToggleSubcommand } from './toggle.subcommand';
import { UnignoreSubcommand } from './unignore.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'embeds.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [
    ToggleSubcommand,
    SiteSubcommand,
    IgnoreSubcommand,
    UnignoreSubcommand,
    StatusSubcommand,
  ],
})
export class EmbedsCommand {}

import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { ConfigSubcommand } from './config.subcommand';
import { LockdownSubcommand } from './lockdown.subcommand';
import { UnlockSubcommand } from './unlock.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'antiraid.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [ConfigSubcommand, LockdownSubcommand, UnlockSubcommand],
})
export class AntiraidCommand {}

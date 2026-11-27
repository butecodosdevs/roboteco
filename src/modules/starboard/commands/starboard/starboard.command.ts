import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { ChannelSubcommand } from './channel.subcommand';
import { DisableSubcommand } from './disable.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'starboard.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [ChannelSubcommand, DisableSubcommand],
})
export class StarboardCommand {}

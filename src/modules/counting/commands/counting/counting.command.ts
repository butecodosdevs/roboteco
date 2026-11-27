import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { ChannelSubcommand } from './channel.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'counting.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [ChannelSubcommand],
})
export class CountingCommand {}

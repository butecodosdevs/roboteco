import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { ApproveSubcommand } from './approve.subcommand';
import { ChannelSubcommand } from './channel.subcommand';
import { DenySubcommand } from './deny.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'suggestions.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [ChannelSubcommand, ApproveSubcommand, DenySubcommand],
})
export class SuggestionsCommand {}

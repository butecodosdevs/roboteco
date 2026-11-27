import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { AddSubcommand } from './add.subcommand';
import { ListSubcommand } from './list.subcommand';
import { RemoveSubcommand } from './remove.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'feeds.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [AddSubcommand, RemoveSubcommand, ListSubcommand],
})
export class FeedsCommand {}

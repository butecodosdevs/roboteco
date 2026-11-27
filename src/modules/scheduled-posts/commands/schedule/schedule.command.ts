import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { CancelSubcommand } from './cancel.subcommand';
import { ListSubcommand } from './list.subcommand';
import { PostSubcommand } from './post.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'scheduledPosts.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [PostSubcommand, ListSubcommand, CancelSubcommand],
})
export class ScheduleCommand {}

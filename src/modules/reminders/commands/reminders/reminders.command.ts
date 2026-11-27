import { SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { CancelSubcommand } from './cancel.subcommand';
import { ListSubcommand } from './list.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'reminders.command'),
  subcommands: [ListSubcommand, CancelSubcommand],
})
export class RemindersCommand {}

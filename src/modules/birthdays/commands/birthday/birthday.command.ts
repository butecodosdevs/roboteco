import { SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { RemoveSubcommand } from './remove.subcommand';
import { SetSubcommand } from './set.subcommand';
import { SetupSubcommand } from './setup.subcommand';
import { UpcomingSubcommand } from './upcoming.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'birthdays.command'),
  guildOnly: true,
  subcommands: [SetSubcommand, RemoveSubcommand, UpcomingSubcommand, SetupSubcommand],
})
export class BirthdayCommand {}

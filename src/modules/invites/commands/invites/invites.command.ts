import { SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { CountSubcommand } from './count.subcommand';
import { TopSubcommand } from './top.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'invites.command'),
  guildOnly: true,
  subcommands: [CountSubcommand, TopSubcommand],
})
export class InvitesCommand {}

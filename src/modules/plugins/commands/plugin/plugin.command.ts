import { SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { ListSubcommand } from './list.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'plugins.command'),
  guildOnly: true,
  subcommands: [ListSubcommand],
})
export class PluginCommand {}

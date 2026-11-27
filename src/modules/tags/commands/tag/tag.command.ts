import { SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { AddSubcommand } from './add.subcommand';
import { DeleteSubcommand } from './delete.subcommand';
import { ListSubcommand } from './list.subcommand';
import { ShowSubcommand } from './show.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'tags.command'),
  guildOnly: true,
  subcommands: [AddSubcommand, ShowSubcommand, ListSubcommand, DeleteSubcommand],
})
export class TagCommand {}

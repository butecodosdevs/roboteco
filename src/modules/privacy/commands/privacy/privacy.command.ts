import { SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { DeleteSubcommand } from './delete.subcommand';
import { ForgetSubcommand } from './forget.subcommand';
import { InfoSubcommand } from './info.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'privacy.command'),
  guildOnly: true,
  subcommands: [InfoSubcommand, DeleteSubcommand, ForgetSubcommand],
})
export class PrivacyCommand {}

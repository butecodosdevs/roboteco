import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { EndSubcommand } from './end.subcommand';
import { RerollSubcommand } from './reroll.subcommand';
import { StartSubcommand } from './start.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'giveaways.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageEvents,
  ),
  guildOnly: true,
  subcommands: [StartSubcommand, EndSubcommand, RerollSubcommand],
})
export class GiveawayCommand {}

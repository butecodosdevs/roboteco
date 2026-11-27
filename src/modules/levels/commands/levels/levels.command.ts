import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { AnnounceSubcommand } from './announce.subcommand';
import { RewardSubcommand } from './reward.subcommand';
import { UnrewardSubcommand } from './unreward.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'levels.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [RewardSubcommand, UnrewardSubcommand, AnnounceSubcommand],
})
export class LevelsCommand {}

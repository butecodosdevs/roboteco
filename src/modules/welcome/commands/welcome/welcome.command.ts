import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { ChannelSubcommand } from './channel.subcommand';
import { MessageSubcommand } from './message.subcommand';
import { RoleSubcommand } from './role.subcommand';
import { TestSubcommand } from './test.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'welcome.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [ChannelSubcommand, MessageSubcommand, RoleSubcommand, TestSubcommand],
})
export class WelcomeCommand {}

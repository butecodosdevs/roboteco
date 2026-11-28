import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { ChannelSubcommand } from './channel.subcommand';
import { FidelitySubcommand } from './fidelity.subcommand';
import { MemberSubcommand } from './member.subcommand';
import { MessageSubcommand } from './message.subcommand';
import { RecordSubcommand } from './record.subcommand';
import { RoleSubcommand } from './role.subcommand';
import { VoiceSubcommand } from './voice.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'dev.command').setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator,
  ),
  guildOnly: true,
  subcommands: [
    MessageSubcommand,
    MemberSubcommand,
    ChannelSubcommand,
    RoleSubcommand,
    VoiceSubcommand,
    FidelitySubcommand,
    RecordSubcommand,
  ],
})
export class DevCommand {}

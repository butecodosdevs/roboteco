import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { DmSubcommand } from './dm.subcommand';
import { EscalationSubcommand } from './escalation.subcommand';
import { LogGroup } from './log/log.group';
import { StatusSubcommand } from './status.subcommand';
import { WarnExpirySubcommand } from './warn-expiry.subcommand';

@Command({
  data: localize(
    new SlashCommandBuilder(),
    'moderation.commands.settings',
  ).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  subcommands: [DmSubcommand, EscalationSubcommand, WarnExpirySubcommand, StatusSubcommand],
  groups: [LogGroup],
})
export class ModerationCommand {}

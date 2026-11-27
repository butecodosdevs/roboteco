import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { AddSubcommand } from './add.subcommand';
import { PanelSubcommand } from './panel.subcommand';
import { RemoveSubcommand } from './remove.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'roles.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageRoles,
  ),
  guildOnly: true,
  subcommands: [AddSubcommand, RemoveSubcommand, PanelSubcommand],
})
export class RolesCommand {}

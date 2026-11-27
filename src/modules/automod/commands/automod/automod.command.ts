import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { InvitesSubcommand } from './invites.subcommand';
import { KeywordsSubcommand } from './keywords.subcommand';
import { LinksSubcommand } from './links.subcommand';
import { ListSubcommand } from './list.subcommand';
import { MentionsSubcommand } from './mentions.subcommand';
import { RemoveSubcommand } from './remove.subcommand';
import { SpamSubcommand } from './spam.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'automod.command').setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild,
  ),
  guildOnly: true,
  subcommands: [
    InvitesSubcommand,
    LinksSubcommand,
    KeywordsSubcommand,
    MentionsSubcommand,
    SpamSubcommand,
    ListSubcommand,
    RemoveSubcommand,
  ],
})
export class AutomodCommand {}

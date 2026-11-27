import { SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { ClaimSubcommand } from './claim.subcommand';
import { InviteSubcommand } from './invite.subcommand';
import { KickSubcommand } from './kick.subcommand';
import { LimitSubcommand } from './limit.subcommand';
import { LockSubcommand } from './lock.subcommand';
import { NameSubcommand } from './name.subcommand';
import { TransferSubcommand } from './transfer.subcommand';
import { UnlockSubcommand } from './unlock.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'tempVoice.command'),
  guildOnly: true,
  subcommands: [
    NameSubcommand,
    LimitSubcommand,
    KickSubcommand,
    InviteSubcommand,
    LockSubcommand,
    UnlockSubcommand,
    ClaimSubcommand,
    TransferSubcommand,
  ],
})
export class VoiceCommand {}

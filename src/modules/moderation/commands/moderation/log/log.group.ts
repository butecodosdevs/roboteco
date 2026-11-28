import { SlashCommandSubcommandGroupBuilder } from 'discord.js';
import { SubcommandGroup } from '@/core';
import { localize } from '@/i18n';
import { CasesSubcommand } from './cases.subcommand';
import { IgnoreSubcommand } from './ignore.subcommand';
import { ServerSubcommand } from './server.subcommand';
import { LogStatusSubcommand } from './status.subcommand';
import { ToggleSubcommand } from './toggle.subcommand';
import { UnignoreSubcommand } from './unignore.subcommand';

@SubcommandGroup(
  localize(new SlashCommandSubcommandGroupBuilder(), 'moderation.commands.logGroup'),
  {
    subcommands: [
      CasesSubcommand,
      ServerSubcommand,
      ToggleSubcommand,
      IgnoreSubcommand,
      UnignoreSubcommand,
      LogStatusSubcommand,
    ],
  },
)
export class LogGroup {}

import { SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize } from '@/i18n';
import { AuditService } from '@/modules/logs/audit.service';
import { auditOptions, emitScenario, scenarioOption, targetOptions } from './emit';

const builder = scenarioOption(
  localize(new SlashCommandSubcommandBuilder(), 'dev.message'),
  'message',
);
targetOptions.messageChannel(builder);
targetOptions.author(builder);
targetOptions.count(builder);

@Subcommand(auditOptions(builder))
export class MessageSubcommand {
  private readonly audit = inject(AuditService);

  execute(interaction: GuildInteraction) {
    return emitScenario(interaction, this.audit);
  }
}

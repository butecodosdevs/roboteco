import { SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize } from '@/i18n';
import { AuditService } from '@/modules/logs/audit.service';
import { auditOptions, emitScenario, scenarioOption, targetOptions } from './emit';

const builder = scenarioOption(localize(new SlashCommandSubcommandBuilder(), 'dev.role'), 'role');
targetOptions.role(builder, true);

@Subcommand(auditOptions(builder))
export class RoleSubcommand {
  private readonly audit = inject(AuditService);

  execute(interaction: GuildInteraction) {
    return emitScenario(interaction, this.audit);
  }
}

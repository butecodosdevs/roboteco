import { SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize } from '@/i18n';
import { AuditService } from '@/modules/logs/audit.service';
import { auditOptions, emitScenario, scenarioOption, targetOptions } from './emit';

const builder = scenarioOption(localize(new SlashCommandSubcommandBuilder(), 'dev.voice'), 'voice');
targetOptions.member(builder);
targetOptions.voiceChannel(builder);

@Subcommand(auditOptions(builder))
export class VoiceSubcommand {
  private readonly audit = inject(AuditService);

  execute(interaction: GuildInteraction) {
    return emitScenario(interaction, this.audit);
  }
}

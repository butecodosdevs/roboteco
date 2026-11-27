import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { CasesService } from '../../cases.service';
import { ModLogService } from '../../mod-log.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'moderation.commands.caseReason')
    .addIntegerOption((opt) =>
      localize(opt, 'moderation.options.caseNumber').setRequired(true).setMinValue(1),
    )
    .addStringOption((opt) =>
      localize(opt, 'moderation.options.newReason').setRequired(true).setMaxLength(400),
    ),
)
export class ReasonSubcommand {
  private readonly cases = inject(CasesService);
  private readonly log = inject(ModLogService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const number = interaction.options.getInteger('case', true);
    const updated = await this.cases.setReason(
      interaction.guildId,
      number,
      interaction.options.getString('reason', true),
    );
    if (updated) await this.log.updateCase(interaction.guild, updated);
    return interaction.reply({
      content: updated
        ? tr('moderation.replies.reasonUpdated', { case: number })
        : tr('moderation.errors.caseNotFound', { case: number }),
      flags: MessageFlags.Ephemeral,
    });
  }
}

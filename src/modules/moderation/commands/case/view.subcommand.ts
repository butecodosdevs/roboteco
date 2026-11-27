import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { CasesService } from '../../cases.service';
import { ModLogService } from '../../mod-log.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'moderation.commands.caseView').addIntegerOption(
    (opt) => localize(opt, 'moderation.options.caseNumber').setRequired(true).setMinValue(1),
  ),
)
export class ViewSubcommand {
  private readonly cases = inject(CasesService);
  private readonly log = inject(ModLogService);

  async execute(interaction: GuildInteraction) {
    const number = interaction.options.getInteger('case', true);
    const entry = await this.cases.get(interaction.guildId, number);
    if (!entry) {
      return interaction.reply({
        content: t(interaction.locale, 'moderation.errors.caseNotFound', { case: number }),
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.reply({
      embeds: [this.log.caseEmbed(interaction.locale, entry)],
      flags: MessageFlags.Ephemeral,
    });
  }
}

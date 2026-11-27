import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { LevelsService } from '../../levels.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'levels.unreward').addIntegerOption((opt) =>
    localize(opt, 'levels.options.level').setRequired(true).setMinValue(1),
  ),
)
export class UnrewardSubcommand {
  private readonly levels = inject(LevelsService);

  async execute(interaction: GuildInteraction) {
    const level = interaction.options.getInteger('level', true);
    const removed = await this.levels.removeReward(interaction.guildId, level);
    return interaction.reply({
      content: t(
        interaction.locale,
        removed ? 'levels.replies.rewardRemoved' : 'levels.replies.noReward',
        { level },
      ),
      flags: MessageFlags.Ephemeral,
    });
  }
}

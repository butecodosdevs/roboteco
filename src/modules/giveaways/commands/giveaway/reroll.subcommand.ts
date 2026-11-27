import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { GiveawaysService } from '../../giveaways.service';
import { finishGiveaway } from '../../jobs/end-giveaway.job';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'giveaways.reroll').addIntegerOption((opt) =>
    localize(opt, 'giveaways.options.id').setRequired(true).setMinValue(1),
  ),
)
export class RerollSubcommand {
  private readonly giveaways = inject(GiveawaysService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const id = interaction.options.getInteger('id', true);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    const giveaway = await this.giveaways.get(interaction.guildId, id);
    if (!giveaway) return reply(tr('giveaways.replies.notFound', { id }));
    if (!giveaway.endedAt) return reply(tr('giveaways.replies.notEnded', { id }));

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await finishGiveaway(interaction.guild, giveaway, true);
    return interaction.editReply(tr('giveaways.replies.rerolled', { id }));
  }
}

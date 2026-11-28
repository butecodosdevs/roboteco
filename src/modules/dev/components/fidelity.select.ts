import { MessageFlags } from 'discord.js';
import { type GuildSelectInteraction, SelectMenu } from '@/core';
import { t } from '@/i18n';

// The core router sends every select kind here, so this one handler answers all four on the panel.
@SelectMenu('dev.fidelitySelect')
export class FidelitySelect {
  async execute(interaction: GuildSelectInteraction) {
    return interaction.reply({
      content: t(interaction.locale, 'dev.replies.received'),
      flags: MessageFlags.Ephemeral,
    });
  }
}

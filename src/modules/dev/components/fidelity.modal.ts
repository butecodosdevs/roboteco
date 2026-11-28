import { MessageFlags } from 'discord.js';
import { type GuildModalInteraction, Modal } from '@/core';
import { t } from '@/i18n';

@Modal('dev.fidelityModal')
export class FidelityModal {
  async execute(interaction: GuildModalInteraction) {
    return interaction.reply({
      content: t(interaction.locale, 'dev.replies.received'),
      flags: MessageFlags.Ephemeral,
    });
  }
}

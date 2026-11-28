import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { Button, customId, type GuildButtonInteraction } from '@/core';
import { translator } from '@/i18n';
import { FidelityModal } from './fidelity.modal';

@Button('dev.fidelityButton')
export class FidelityButton {
  async execute(interaction: GuildButtonInteraction) {
    const tr = translator(interaction.locale);
    const field = (id: 'short' | 'long', style: TextInputStyle, required: boolean) =>
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(id)
          .setLabel(tr(`dev.panel.${id}`))
          .setStyle(style)
          .setRequired(required),
      );
    return interaction.showModal(
      new ModalBuilder()
        .setCustomId(customId(FidelityModal))
        .setTitle(tr('dev.panel.title'))
        .addComponents(
          field('short', TextInputStyle.Short, true),
          field('long', TextInputStyle.Paragraph, false),
        ),
    );
  }
}

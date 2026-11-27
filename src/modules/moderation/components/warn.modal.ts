import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type User,
} from 'discord.js';
import { customId, type GuildModalInteraction, inject, Modal } from '@/core';
import { t } from '@/i18n';
import { ModerationService } from '../moderation.service';

export function warnModal(locale: string, target: User): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(customId(WarnModal, target.id))
    .setTitle(t(locale, 'moderation.modal.warnTitle', { user: target.username }).slice(0, 45))
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel(t(locale, 'moderation.modal.reason'))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(400),
      ),
    );
}

@Modal('moderation.warn')
export class WarnModal {
  private readonly moderation = inject(ModerationService);

  async execute(interaction: GuildModalInteraction, [targetId = '']: string[]) {
    const target = await interaction.client.users.fetch(targetId);
    return this.moderation.apply(interaction, {
      action: 'warn',
      target,
      reason: interaction.fields.getTextInputValue('reason'),
      requireMember: true,
      run: async () => {},
    });
  }
}

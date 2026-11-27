import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type User,
} from 'discord.js';
import { customId, type GuildModalInteraction, inject, Modal } from '@/core';
import { t } from '@/i18n';
import { parseDuration } from '@/lib/duration';
import { ModerationService } from '../moderation.service';

const maxTimeout = 28 * 86_400;

export function timeoutModal(locale: string, target: User): ModalBuilder {
  const row = (input: TextInputBuilder) =>
    new ActionRowBuilder<TextInputBuilder>().addComponents(input);
  return new ModalBuilder()
    .setCustomId(customId(TimeoutModal, target.id))
    .setTitle(t(locale, 'moderation.modal.timeoutTitle', { user: target.username }).slice(0, 45))
    .addComponents(
      row(
        new TextInputBuilder()
          .setCustomId('duration')
          .setLabel(t(locale, 'moderation.modal.duration'))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue('1h')
          .setMaxLength(20),
      ),
      row(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel(t(locale, 'moderation.modal.reason'))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(400),
      ),
    );
}

@Modal('moderation.timeout')
export class TimeoutModal {
  private readonly moderation = inject(ModerationService);

  async execute(interaction: GuildModalInteraction, [targetId = '']: string[]) {
    const seconds = parseDuration(interaction.fields.getTextInputValue('duration'), {
      max: maxTimeout,
    });
    if (!seconds) {
      return interaction.reply({
        content: t(interaction.locale, 'moderation.errors.invalidDuration'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const target = await interaction.client.users.fetch(targetId);
    return this.moderation.apply(interaction, {
      action: 'timeout',
      target,
      reason: interaction.fields.getTextInputValue('reason') || null,
      durationSeconds: seconds,
      requireMember: true,
      check: (member) =>
        member?.moderatable
          ? undefined
          : { key: 'moderation.errors.cannotTimeout', vars: { user: target.toString() } },
      run: async ({ member, auditReason }) => {
        await member?.timeout(seconds * 1000, auditReason);
      },
    });
  }
}

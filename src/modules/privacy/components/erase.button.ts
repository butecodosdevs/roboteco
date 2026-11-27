import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { Button, customId, eraseUserData, type GuildButtonInteraction } from '@/core';
import { t, translator } from '@/i18n';
import { logger } from '@/logger';

export type EraseScope = 'all' | 'guild';

export function eraseButtons(
  locale: string,
  requesterId: string,
  targetId: string,
  scope: EraseScope,
) {
  const tr = translator(locale);
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(customId(EraseButton, 'confirm', requesterId, targetId, scope))
        .setStyle(ButtonStyle.Danger)
        .setLabel(tr('privacy.buttons.confirm')),
      new ButtonBuilder()
        .setCustomId(customId(EraseButton, 'cancel', requesterId, targetId, scope))
        .setStyle(ButtonStyle.Secondary)
        .setLabel(tr('privacy.buttons.cancel')),
    ),
  ];
}

@Button('privacy.erase')
export class EraseButton {
  async execute(
    interaction: GuildButtonInteraction,
    [action, requesterId, targetId = '', scope]: string[],
  ) {
    const tr = translator(interaction.locale);
    if (interaction.user.id !== requesterId) {
      return interaction.reply({
        content: t(interaction.locale, 'privacy.replies.notYours'),
        flags: MessageFlags.Ephemeral,
      });
    }
    if (action !== 'confirm') {
      return interaction.update({ content: tr('privacy.replies.cancelled'), components: [] });
    }
    await interaction.deferUpdate();
    await eraseUserData(targetId, scope === 'guild' ? interaction.guildId : undefined);
    logger.info(
      { user: targetId, by: requesterId, scope, guild: interaction.guildId },
      'User data erased',
    );
    return interaction.editReply({ content: tr('privacy.replies.deleted'), components: [] });
  }
}

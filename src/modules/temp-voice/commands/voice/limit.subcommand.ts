import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { currentRoom } from './current-room';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tempVoice.limit').addIntegerOption((opt) =>
    localize(opt, 'tempVoice.options.size').setRequired(true).setMinValue(0).setMaxValue(99),
  ),
)
export class LimitSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const current = await currentRoom(interaction);
    if (!current) return;
    const size = interaction.options.getInteger('size', true);
    await current.channel.setUserLimit(size);
    const content = size
      ? tr('tempVoice.replies.limited', { size })
      : tr('tempVoice.replies.unlimited');
    return interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

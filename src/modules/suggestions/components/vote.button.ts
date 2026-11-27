import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Guild,
  type MessageCreateOptions,
} from 'discord.js';
import { Button, customId, type GuildButtonInteraction, inject } from '@/core';
import { translator } from '@/i18n';
import { type Suggestion, SuggestionsService, type Votes } from '../suggestions.service';

const colors = { pending: 0x5865f2, approved: 0x2ecc71, denied: 0xe74c3c } as const;

export async function renderSuggestion(
  guild: Guild,
  suggestion: Suggestion,
  votes: Votes,
): Promise<Pick<MessageCreateOptions, 'embeds' | 'components'>> {
  const tr = translator(guild.preferredLocale);
  const author = await guild.client.users.fetch(suggestion.authorId).catch(() => null);
  const embed = new EmbedBuilder()
    .setColor(colors[suggestion.status])
    .setDescription(suggestion.content)
    .setFooter({
      text: tr('suggestions.embed.footer', {
        id: suggestion.id,
        status: tr(`suggestions.status.${suggestion.status}`),
      }),
    })
    .setTimestamp(suggestion.createdAt);
  if (author) embed.setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() });
  if (suggestion.decidedBy) {
    embed.addFields({
      name: tr('suggestions.embed.decision', { moderator: `<@${suggestion.decidedBy}>` }),
      value: suggestion.decisionReason ?? tr('suggestions.embed.noReason'),
    });
  }

  const open = suggestion.status === 'pending';
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customId(VoteButton, suggestion.id, 'up'))
      .setStyle(ButtonStyle.Success)
      .setEmoji('👍')
      .setLabel(String(votes.up))
      .setDisabled(!open),
    new ButtonBuilder()
      .setCustomId(customId(VoteButton, suggestion.id, 'down'))
      .setStyle(ButtonStyle.Danger)
      .setEmoji('👎')
      .setLabel(String(votes.down))
      .setDisabled(!open),
  );
  return { embeds: [embed], components: [row] };
}

@Button('suggestions.vote')
export class VoteButton {
  private readonly suggestions = inject(SuggestionsService);

  async execute(interaction: GuildButtonInteraction, [id, direction]: string[]) {
    const suggestion = await this.suggestions.get(interaction.guildId, Number(id));
    if (suggestion?.status !== 'pending') {
      return interaction.deferUpdate();
    }
    const votes = await this.suggestions.vote(
      suggestion.id,
      interaction.user.id,
      direction === 'up' ? 1 : -1,
    );
    return interaction.update(await renderSuggestion(interaction.guild, suggestion, votes));
  }
}

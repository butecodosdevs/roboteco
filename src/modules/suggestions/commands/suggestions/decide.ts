import { type GuildInteraction, inject } from '@/core';
import { renderSuggestion } from '../../components/vote.button';
import { SuggestionsService } from '../../suggestions.service';

export async function decideSuggestion(
  interaction: GuildInteraction,
  id: number,
  status: 'approved' | 'denied',
): Promise<boolean> {
  const suggestions = inject(SuggestionsService);
  const existing = await suggestions.get(interaction.guildId, id);
  if (!existing) return false;

  const updated = await suggestions.decide(
    id,
    status,
    interaction.user.id,
    interaction.options.getString('reason'),
  );
  if (!updated?.channelId || !updated.messageId) return true;

  const channel = await interaction.guild.channels.fetch(updated.channelId).catch(() => null);
  const message = channel?.isTextBased()
    ? await channel.messages.fetch(updated.messageId).catch(() => null)
    : null;
  const view = await renderSuggestion(interaction.guild, updated, await suggestions.votes(id));
  await message?.edit(view).catch(() => undefined);
  return true;
}

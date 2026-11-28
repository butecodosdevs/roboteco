import { ChannelType, type Message } from 'discord.js';
import type { GuildInteraction } from '@/core';
import { parseMessageRef } from '../../reaction-roles.service';

export async function findMessage(
  interaction: GuildInteraction,
): Promise<Message<true> | undefined> {
  const ref = parseMessageRef(interaction.options.getString('message', true));
  if (!ref) return undefined;
  const picked = interaction.options.getChannel('channel', false, [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
  ]);
  const channelId = ref.channelId ?? picked?.id ?? interaction.channelId;
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return undefined;
  return (await channel.messages.fetch(ref.messageId).catch(() => null)) ?? undefined;
}

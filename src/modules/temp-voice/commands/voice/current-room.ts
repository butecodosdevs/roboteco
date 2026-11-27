import { ChannelType, MessageFlags, PermissionFlagsBits, type VoiceChannel } from 'discord.js';
import { type GuildInteraction, inject } from '@/core';
import { type MessageKey, t } from '@/i18n';
import { type TempVoiceChannel, TempVoiceService } from '../../temp-voice.service';

export interface CurrentRoom {
  channel: VoiceChannel;
  room: TempVoiceChannel;
}

export async function refuse(
  interaction: GuildInteraction,
  key: MessageKey,
  vars?: Record<string, string>,
) {
  await interaction.reply({
    content: t(interaction.locale, key, vars),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
  return undefined;
}

export async function currentRoom(
  interaction: GuildInteraction,
  { ownerOnly = true } = {},
): Promise<CurrentRoom | undefined> {
  const tempVoice = inject(TempVoiceService);
  const channel = interaction.member.voice.channel;
  const room =
    channel?.type === ChannelType.GuildVoice ? await tempVoice.room(channel.id) : undefined;
  if (!channel || channel.type !== ChannelType.GuildVoice || !room)
    return refuse(interaction, 'tempVoice.replies.notInTemp');
  const isOwner =
    room.ownerId === interaction.user.id ||
    interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels);
  if (ownerOnly && !isOwner) return refuse(interaction, 'tempVoice.replies.notOwner');
  return { channel, room };
}

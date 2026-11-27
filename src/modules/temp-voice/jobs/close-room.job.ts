import { ChannelType, type Client } from 'discord.js';
import { inject, Job } from '@/core';
import { type CloseReason, roomState, TempVoiceService } from '../temp-voice.service';

export interface CloseRoomPayload {
  guildId: string;
  channelId: string;
  reason: CloseReason;
}

@Job('temp-voice.close')
export class CloseRoomJob {
  async execute({ guildId, channelId, reason }: CloseRoomPayload, client: Client<true>) {
    const tempVoice = inject(TempVoiceService);
    const room = await tempVoice.room(channelId);
    if (!room || room.closeReason !== reason) return;
    const channel = await client.guilds.cache
      .get(guildId)
      ?.channels.fetch(channelId)
      .catch(() => null);
    if (channel?.type !== ChannelType.GuildVoice) return tempVoice.forget(channelId);
    if (roomState(channel) === reason) return tempVoice.close(channel, reason);
    await tempVoice.setCloseTimer(channelId, null, null);
  }
}

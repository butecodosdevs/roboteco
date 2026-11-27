import { ChannelType, type Guild, type VoiceChannel } from 'discord.js';
import { cancelJob, Injectable, inject, schedule } from '@/core';
import { CloseRoomJob } from './jobs/close-room.job';
import { roomState, TempVoiceService } from './temp-voice.service';

@Injectable()
export class RoomTimersService {
  private readonly tempVoice = inject(TempVoiceService);

  async evaluate(channel: VoiceChannel): Promise<void> {
    const room = await this.tempVoice.room(channel.id);
    if (!room) return;
    const state = roomState(channel);
    if (state === room.closeReason) return;

    if (room.closeJobId) await cancelJob(room.closeJobId);
    if (state === 'active') return this.tempVoice.setCloseTimer(channel.id, null, null);

    const hub = await this.tempVoice.hub(room.hubId);
    const seconds =
      state === 'empty' ? (hub?.emptyTimeoutSeconds ?? 60) : (hub?.idleTimeoutSeconds ?? 600);
    if (state === 'empty' && seconds === 0) return this.tempVoice.close(channel, 'empty');
    if (state === 'idle' && seconds === 0)
      return this.tempVoice.setCloseTimer(channel.id, null, null);

    const jobId = await schedule(CloseRoomJob, new Date(Date.now() + seconds * 1000), {
      guildId: channel.guildId,
      channelId: channel.id,
      reason: state,
    });
    await this.tempVoice.setCloseTimer(channel.id, jobId, state);
  }

  async sweep(guilds: Iterable<Guild>): Promise<void> {
    for (const guild of guilds) {
      for (const room of await this.tempVoice.rooms(guild.id)) {
        const channel = await guild.channels.fetch(room.channelId).catch(() => null);
        if (channel?.type === ChannelType.GuildVoice) await this.evaluate(channel);
        else await this.tempVoice.forget(room.channelId);
      }
    }
  }
}

import { ChannelType, type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { RoomTimersService } from '../room-timers.service';
import { TempVoiceService } from '../temp-voice.service';

@On(Events.VoiceStateUpdate)
export class VoiceStateUpdateEvent {
  private readonly tempVoice = inject(TempVoiceService);
  private readonly timers = inject(RoomTimersService);

  async execute(...[before, after]: ClientEvents[Events.VoiceStateUpdate]) {
    if (
      after.channelId &&
      after.channelId !== before.channelId &&
      after.member &&
      !after.member.user.bot
    ) {
      const hub = await this.tempVoice.hub(after.channelId);
      if (hub) await this.tempVoice.joinedHub(after.member, hub);
    }
    if (before.channel?.type === ChannelType.GuildVoice && before.channelId !== after.channelId) {
      await this.timers.evaluate(before.channel);
    }
    if (after.channel?.type === ChannelType.GuildVoice) await this.timers.evaluate(after.channel);
  }
}

import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { TempVoiceService } from '../temp-voice.service';

@On(Events.ChannelDelete)
export class ChannelDeleteEvent {
  private readonly tempVoice = inject(TempVoiceService);

  async execute(...[channel]: ClientEvents[Events.ChannelDelete]) {
    if (channel.isDMBased()) return;
    await this.tempVoice.forget(channel.id);
    await this.tempVoice.removeHub(channel.guildId, channel.id);
  }
}

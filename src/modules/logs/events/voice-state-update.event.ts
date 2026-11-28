import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { LogsService } from '../logs.service';

@On(Events.VoiceStateUpdate)
export class VoiceStateUpdateEvent {
  private readonly logs = inject(LogsService);

  async execute(...[before, after]: ClientEvents[Events.VoiceStateUpdate]) {
    await this.logs.voiceStateUpdated(before, after);
  }
}

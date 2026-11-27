import { type Client, GatewayIntentBits } from 'discord.js';
import { inject, Module, type OnGuildRemove, type OnReady } from '@/core';
import { TempvoiceCommand } from './commands/tempvoice/tempvoice.command';
import { VoiceCommand } from './commands/voice/voice.command';
import { ChannelDeleteEvent } from './events/channel-delete.event';
import { VoiceStateUpdateEvent } from './events/voice-state-update.event';
import { CloseRoomJob } from './jobs/close-room.job';
import { RoomTimersService } from './room-timers.service';
import { TempVoiceService } from './temp-voice.service';

@Module({
  intents: [GatewayIntentBits.GuildVoiceStates],
  commands: [TempvoiceCommand, VoiceCommand],
  events: [VoiceStateUpdateEvent, ChannelDeleteEvent],
  jobs: [CloseRoomJob],
})
export class TempVoiceModule implements OnReady, OnGuildRemove {
  private readonly tempVoice = inject(TempVoiceService);
  private readonly timers = inject(RoomTimersService);

  onReady(client: Client<true>) {
    return this.timers.sweep(client.guilds.cache.values());
  }

  onGuildRemove(guildId: string) {
    return this.tempVoice.purgeGuild(guildId);
  }
}

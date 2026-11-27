import { GatewayIntentBits } from 'discord.js';
import { inject, Module, type OnGuildRemove, type OnReady } from '@/core';
import { HoneypotCommand } from './commands/honeypot/honeypot.command';
import { ChannelDeleteEvent } from './events/channel-delete.event';
import { MessageCreateEvent } from './events/message-create.event';
import { HoneypotService } from './honeypot.service';

@Module({
  intents: [GatewayIntentBits.GuildMessages],
  commands: [HoneypotCommand],
  events: [MessageCreateEvent, ChannelDeleteEvent],
})
export class HoneypotModule implements OnReady, OnGuildRemove {
  private readonly honeypots = inject(HoneypotService);

  onReady() {
    return this.honeypots.load();
  }

  async onGuildRemove(guildId: string) {
    this.honeypots.forget(guildId);
  }
}

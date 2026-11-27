import { type DMChannel, Events, type NonThreadGuildBasedChannel } from 'discord.js';
import { inject, On } from '@/core';
import { HoneypotService } from '../honeypot.service';

@On(Events.ChannelDelete)
export class ChannelDeleteEvent {
  private readonly honeypots = inject(HoneypotService);

  async execute(channel: DMChannel | NonThreadGuildBasedChannel) {
    if (channel.isDMBased()) return;
    if (this.honeypots.get(channel.guildId)?.channelId === channel.id) {
      await this.honeypots.clear(channel.guildId);
    }
  }
}

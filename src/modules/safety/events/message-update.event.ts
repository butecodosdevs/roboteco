import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { SafetyService } from '../safety.service';

@On(Events.MessageUpdate)
export class MessageUpdateEvent {
  private readonly safety = inject(SafetyService);

  async execute(...[before, after]: ClientEvents[Events.MessageUpdate]) {
    // Discord also sends an update when it adds link previews; only a changed text needs a scan.
    if (!before.partial && before.content === after.content) return;
    const message = after.partial ? await after.fetch().catch(() => null) : after;
    if (!message?.inGuild() || message.system || message.author.id === message.client.user.id) {
      return;
    }
    await this.safety.process(message);
  }
}

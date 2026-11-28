import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { memberData } from '../discord-data.service';
import { PluginEventsService } from '../plugin-events.service';

@On(Events.MessageCreate)
export class MessageCreateEvent {
  private readonly events = inject(PluginEventsService);

  async execute(...[message]: ClientEvents[Events.MessageCreate]) {
    if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
    await this.events.dispatch('messageCreate', message.guildId, message.channelId, {
      message: {
        id: message.id,
        channelId: message.channelId,
        authorId: message.author.id,
        content: message.content,
        attachments: message.attachments.map((a) => a.url),
      },
      member: message.member ? memberData(message.member) : null,
    });
  }
}

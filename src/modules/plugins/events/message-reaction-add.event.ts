import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { PluginEventsService } from '../plugin-events.service';

@On(Events.MessageReactionAdd)
export class MessageReactionAddEvent {
  private readonly events = inject(PluginEventsService);

  async execute(...[reaction, user]: ClientEvents[Events.MessageReactionAdd]) {
    const { message } = reaction;
    if (user.bot || !message.guildId) return;
    await this.events.dispatch('reactionAdd', message.guildId, message.channelId, {
      messageId: message.id,
      channelId: message.channelId,
      userId: user.id,
      // Custom emojis by ID, so a plugin can react back with the same one.
      emoji: reaction.emoji.id ?? reaction.emoji.name ?? '',
    });
  }
}

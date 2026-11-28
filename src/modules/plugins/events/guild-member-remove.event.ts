import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { PluginEventsService } from '../plugin-events.service';

@On(Events.GuildMemberRemove)
export class GuildMemberRemoveEvent {
  private readonly events = inject(PluginEventsService);

  async execute(...[member]: ClientEvents[Events.GuildMemberRemove]) {
    if (member.user.bot) return;
    await this.events.dispatch('memberLeave', member.guild.id, null, {
      userId: member.id,
      username: member.user.username,
      roles: member.roles.cache.filter((r) => r.id !== member.guild.id).map((r) => r.id),
    });
  }
}

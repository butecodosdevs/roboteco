import { type ClientEvents, Events } from 'discord.js';
import { inject, On } from '@/core';
import { memberData } from '../discord-data.service';
import { PluginEventsService } from '../plugin-events.service';

@On(Events.GuildMemberAdd)
export class GuildMemberAddEvent {
  private readonly events = inject(PluginEventsService);

  async execute(...[member]: ClientEvents[Events.GuildMemberAdd]) {
    if (member.user.bot) return;
    await this.events.dispatch('memberJoin', member.guild.id, null, { member: memberData(member) });
  }
}

import { Events, type Guild } from 'discord.js';
import { inject, On } from '@/core';
import { GuildsService } from '../guilds.service';

@On(Events.GuildCreate)
export class GuildCreateEvent {
  private readonly guilds = inject(GuildsService);

  async execute(guild: Guild) {
    await this.guilds.joined(guild);
  }
}

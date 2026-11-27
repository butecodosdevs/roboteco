import { Events, type Guild } from 'discord.js';
import { inject, On } from '@/core';
import { GuildsService } from '../guilds.service';

@On(Events.GuildDelete)
export class GuildDeleteEvent {
  private readonly guilds = inject(GuildsService);

  async execute(guild: Guild) {
    if (!guild.available) return;
    await this.guilds.left(guild);
  }
}

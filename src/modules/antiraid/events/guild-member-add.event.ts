import { Events, type GuildMember } from 'discord.js';
import { inject, On } from '@/core';
import { AntiraidService } from '../antiraid.service';

@On(Events.GuildMemberAdd)
export class GuildMemberAddEvent {
  private readonly antiraid = inject(AntiraidService);

  async execute(member: GuildMember) {
    await this.antiraid.track(member.guild);
  }
}

import { Events, type GuildMember } from 'discord.js';
import { inject, On } from '@/core';
import { WelcomeService } from '../welcome.service';

@On(Events.GuildMemberAdd)
export class GuildMemberAddEvent {
  private readonly welcome = inject(WelcomeService);

  async execute(member: GuildMember) {
    if (member.user.bot) return;
    await this.welcome.greet(member);
  }
}

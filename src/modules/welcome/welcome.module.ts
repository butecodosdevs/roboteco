import { GatewayIntentBits } from 'discord.js';
import { Module } from '@/core';
import { WelcomeCommand } from './commands/welcome/welcome.command';
import { GuildMemberAddEvent } from './events/guild-member-add.event';

@Module({
  intents: [GatewayIntentBits.GuildMembers],
  commands: [WelcomeCommand],
  events: [GuildMemberAddEvent],
})
export class WelcomeModule {}

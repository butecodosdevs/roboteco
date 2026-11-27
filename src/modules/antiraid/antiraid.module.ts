import { GatewayIntentBits } from 'discord.js';
import { Module } from '@/core';
import { ModerationModule } from '@/modules/moderation/moderation.module';
import { AntiraidCommand } from './commands/antiraid/antiraid.command';
import { GuildMemberAddEvent } from './events/guild-member-add.event';

@Module({
  imports: [ModerationModule],
  intents: [GatewayIntentBits.GuildMembers],
  commands: [AntiraidCommand],
  events: [GuildMemberAddEvent],
})
export class AntiraidModule {}

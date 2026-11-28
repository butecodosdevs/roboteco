import { GatewayIntentBits } from 'discord.js';
import { Module } from '@/core';
import { EmbedsCommand } from './commands/embeds/embeds.command';
import { MessageCreateEvent } from './events/message-create.event';

@Module({
  intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  commands: [EmbedsCommand],
  events: [MessageCreateEvent],
})
export class EmbedsModule {}

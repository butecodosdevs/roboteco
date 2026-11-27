import { GatewayIntentBits, Partials } from 'discord.js';
import { Module } from '@/core';
import { LogsCommand } from './commands/logs/logs.command';
import { ChannelCreateEvent } from './events/channel-create.event';
import { ChannelDeleteEvent } from './events/channel-delete.event';
import { ChannelUpdateEvent } from './events/channel-update.event';
import { GuildBanAddEvent } from './events/guild-ban-add.event';
import { GuildBanRemoveEvent } from './events/guild-ban-remove.event';
import { GuildMemberAddEvent } from './events/guild-member-add.event';
import { GuildMemberRemoveEvent } from './events/guild-member-remove.event';
import { GuildMemberUpdateEvent } from './events/guild-member-update.event';
import { MessageDeleteEvent } from './events/message-delete.event';
import { MessageBulkDeleteEvent } from './events/message-delete-bulk.event';
import { MessageUpdateEvent } from './events/message-update.event';
import { RoleCreateEvent } from './events/role-create.event';
import { RoleDeleteEvent } from './events/role-delete.event';
import { RoleUpdateEvent } from './events/role-update.event';

@Module({
  intents: [
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
  commands: [LogsCommand],
  events: [
    MessageUpdateEvent,
    MessageDeleteEvent,
    MessageBulkDeleteEvent,
    GuildMemberAddEvent,
    GuildMemberRemoveEvent,
    GuildMemberUpdateEvent,
    GuildBanAddEvent,
    GuildBanRemoveEvent,
    ChannelCreateEvent,
    ChannelDeleteEvent,
    ChannelUpdateEvent,
    RoleCreateEvent,
    RoleDeleteEvent,
    RoleUpdateEvent,
  ],
})
export class LogsModule {}

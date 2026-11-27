import { Module } from '@/core';
import { GuildCreateEvent } from './events/guild-create.event';
import { GuildDeleteEvent } from './events/guild-delete.event';
import { GuildPurgeJob } from './jobs/guild-purge.job';

@Module({ events: [GuildCreateEvent, GuildDeleteEvent], jobs: [GuildPurgeJob] })
export class GuildsModule {}

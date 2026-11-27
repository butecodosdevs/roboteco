import type { Client } from 'discord.js';
import { eq } from 'drizzle-orm';
import { Job, purgeGuildData } from '@/core';
import { db, forgetGuildSettings, schema } from '@/db';
import { logger } from '@/logger';

export interface GuildPurgePayload {
  guildId: string;
}

@Job('guilds.purge')
export class GuildPurgeJob {
  async execute({ guildId }: GuildPurgePayload, client: Client<true>) {
    if (client.guilds.cache.has(guildId)) return;
    await purgeGuildData(guildId);
    await db.delete(schema.guilds).where(eq(schema.guilds.id, guildId));
    forgetGuildSettings(guildId);
    logger.info({ guild: guildId }, 'Guild data purged');
  }
}

import type { Guild } from 'discord.js';
import { config } from '@/config';
import { cancelJob, Injectable, schedule } from '@/core';
import { db, getGuildSettings, schema, updateGuildSettings } from '@/db';
import { logger } from '@/logger';
import { GuildPurgeJob } from './jobs/guild-purge.job';

const dayMs = 86_400_000;

@Injectable()
export class GuildsService {
  async joined(guild: Guild): Promise<void> {
    await db
      .insert(schema.guilds)
      .values({ id: guild.id, locale: guild.preferredLocale })
      .onConflictDoNothing();
    const purgeJobId = (await getGuildSettings(guild.id))?.purgeJobId;
    if (purgeJobId) {
      await cancelJob(purgeJobId);
      await updateGuildSettings(guild.id, guild.preferredLocale, { purgeJobId: null });
      logger.info({ guild: guild.id }, 'Rejoined guild, data purge cancelled');
    }
  }

  async left(guild: Guild): Promise<void> {
    const runAt = new Date(Date.now() + config.guildDataRetentionDays * dayMs);
    const purgeJobId = await schedule(GuildPurgeJob, runAt, { guildId: guild.id });
    await updateGuildSettings(guild.id, guild.preferredLocale, { purgeJobId });
    logger.info(
      { guild: guild.id, purgeAt: runAt.toISOString() },
      'Left guild, data purge scheduled',
    );
  }
}

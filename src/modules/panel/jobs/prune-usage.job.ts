import type { Client } from 'discord.js';
import { config } from '@/config';
import { inject, Job, schedule } from '@/core';
import { logger } from '@/logger';
import { PanelUsageService } from '../panel-usage.service';

/** Once a day is plenty for a table the panel reads in windows of up to 365 days. */
export const pruneIntervalMs = 24 * 60 * 60_000;

/**
 * Drops `command_usage` rows past the retention window. The table holds a user id per run and
 * nothing else deletes from it, so without this it grows forever and keeps who-ran-what long after
 * anyone looks at it.
 */
@Job('panel.prune-usage')
export class PruneUsageJob {
  async execute(_payload: Record<string, never>, _client: Client<true>) {
    await schedule(PruneUsageJob, new Date(Date.now() + pruneIntervalMs), {});
    try {
      const removed = await inject(PanelUsageService).pruneOlderThan(config.guildDataRetentionDays);
      if (removed > 0) logger.info({ removed }, 'Panel: pruned old command usage');
    } catch (error) {
      logger.warn({ err: error }, 'Panel: pruning command usage failed');
    }
  }
}

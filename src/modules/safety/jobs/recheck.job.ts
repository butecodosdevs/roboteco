import type { Client } from 'discord.js';
import { inject, Job, schedule } from '@/core';
import { logger } from '@/logger';
import { RechecksService } from '../rechecks.service';
import { SafetyService } from '../safety.service';

export const recheckIntervalMs = 5 * 60_000;
const batchSize = 100;

@Job('safety.recheck')
export class RecheckJob {
  async execute(_payload: Record<string, never>, client: Client<true>) {
    await schedule(RecheckJob, new Date(Date.now() + recheckIntervalMs), {});
    const rechecks = inject(RechecksService);
    const safety = inject(SafetyService);

    try {
      for (const recheck of await rechecks.takeDue(batchSize)) {
        const message = await rechecks.message(client, recheck);
        if (message) await safety.process(message, recheck.attempt);
      }
    } catch (error) {
      logger.warn({ err: error }, 'Safety: rechecks failed');
    }
  }
}

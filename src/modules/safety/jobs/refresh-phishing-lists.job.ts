import { inject, Job, schedule } from '@/core';
import { logger } from '@/logger';
import { PhishingListService } from '../phishing-list.service';

export const refreshIntervalMs = 60 * 60_000;
const retryIntervalMs = 5 * 60_000;

@Job('safety.refreshPhishingLists')
export class RefreshPhishingListsJob {
  async execute(_payload: Record<string, never>) {
    const lists = inject(PhishingListService);
    try {
      await lists.refresh();
    } catch (error) {
      logger.warn({ err: error }, 'Safety: phishing list refresh failed');
    }
    // Until a first download works there is nothing to match against, so try again sooner.
    const delay = lists.size > 0 ? refreshIntervalMs : retryIntervalMs;
    await schedule(RefreshPhishingListsJob, new Date(Date.now() + delay), {});
  }
}

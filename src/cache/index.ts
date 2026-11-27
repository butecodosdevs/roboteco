import { Valkey } from 'iovalkey';
import { config } from '@/config';
import { logger } from '@/logger';

export const cache = new Valkey(config.valkeyUrl, {
  keyPrefix: 'roboteco:',
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

let lastErrorLog = 0;
cache.on('error', (error) => {
  if (Date.now() - lastErrorLog < 30_000) return;
  lastErrorLog = Date.now();
  logger.warn({ err: error }, 'Valkey connection error');
});

export const isCacheReady = () => cache.status === 'ready';

export async function closeCache(): Promise<void> {
  if (cache.status === 'ready') await cache.quit();
  else cache.disconnect();
}

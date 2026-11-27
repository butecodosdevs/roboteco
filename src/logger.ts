import * as Sentry from '@sentry/node';
import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.logLevel,
  ...(config.env === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
    },
  }),
});

if (config.sentryDsn) {
  Sentry.init({ dsn: config.sentryDsn, environment: config.env });
}

export function reportError(
  error: unknown,
  context: Record<string, unknown>,
  message: string,
): void {
  logger.error({ err: error, ...context }, message);
  if (config.sentryDsn) Sentry.captureException(error, { extra: context });
}

export async function flushErrors(): Promise<void> {
  if (config.sentryDsn) await Sentry.flush(2000);
}

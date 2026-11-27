import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { logger } from '@/logger';
import { closeDb, db } from './client';

const migrationsFolder = resolve(import.meta.dirname, '../../drizzle');

try {
  await migrate(db, { migrationsFolder });
  logger.info({ migrationsFolder }, 'Migrations applied');
} finally {
  await closeDb();
}

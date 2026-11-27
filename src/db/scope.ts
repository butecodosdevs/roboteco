import { and, eq, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

export function userScope(
  userColumn: PgColumn,
  userId: string,
  guildColumn: PgColumn,
  guildId?: string,
): SQL | undefined {
  return guildId ? and(eq(userColumn, userId), eq(guildColumn, guildId)) : eq(userColumn, userId);
}

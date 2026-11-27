import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';

export interface UsageRow {
  command: string;
  total: number;
}

export interface UsageDay {
  day: string;
  total: number;
}

export interface CommandUsageReport {
  /** Days covered by the window. */
  days: number;
  total: number;
  /** Most used first. */
  commands: UsageRow[];
  /** One entry per day in the window, including days with no runs. */
  series: UsageDay[];
  /** Distinct members, so one person cannot look like a trend. */
  members: number;
}

/**
 * Usage is a table, not a counter: it answers "who used what when" and lets the panel group by day
 * without a metrics backend. Reads are indexed by guild; writes are fire-and-forget.
 */
export async function usageReport(guildId: string, days = 30): Promise<CommandUsageReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const window = and(
    eq(schema.commandUsage.guildId, guildId),
    gte(schema.commandUsage.usedAt, since),
  );
  const [commands, daily, members] = await Promise.all([
    db
      .select({ command: schema.commandUsage.command, total: count() })
      .from(schema.commandUsage)
      .where(window)
      .groupBy(schema.commandUsage.command)
      .orderBy(desc(count()), schema.commandUsage.command)
      .limit(200),
    db
      .select({
        day: sql<string>`to_char(${schema.commandUsage.usedAt} at time zone 'utc', 'YYYY-MM-DD')`,
        total: count(),
      })
      .from(schema.commandUsage)
      .where(window)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ total: sql<number>`count(distinct ${schema.commandUsage.userId})` })
      .from(schema.commandUsage)
      .where(window),
  ]);

  const byDay = new Map(daily.map((row) => [row.day, Number(row.total)]));
  const series: UsageDay[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    series.push({ day, total: byDay.get(day) ?? 0 });
  }
  const rows = commands.map((row) => ({ command: row.command, total: Number(row.total) }));
  return {
    days,
    total: rows.reduce((sum, row) => sum + row.total, 0),
    commands: rows,
    series,
    members: Number(members[0]?.total ?? 0),
  };
}

/** One insert per run. Never awaited by the router: a metric must not fail a command. */
export function recordUsage(
  guildId: string,
  command: string,
  userId: string,
  source: 'builtin' | 'plugin',
): void {
  void db
    .insert(schema.commandUsage)
    .values({ guildId, command, userId, source })
    .catch(() => undefined);
}

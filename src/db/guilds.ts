import { eq } from 'drizzle-orm';
import { db } from './client';
import * as schema from './schema';

export type GuildSettings = typeof schema.guilds.$inferSelect;
export type GuildSettingsUpdate = Partial<Omit<typeof schema.guilds.$inferInsert, 'id' | 'locale'>>;

const ttlMs = 5 * 60_000;
// Event handlers read settings on every message or reaction; updates below invalidate the entry.
const cache = new Map<string, { value: GuildSettings | undefined; expires: number }>();

export async function getGuildSettings(guildId: string): Promise<GuildSettings | undefined> {
  const cached = cache.get(guildId);
  if (cached && cached.expires > Date.now()) return cached.value;
  const [settings] = await db.select().from(schema.guilds).where(eq(schema.guilds.id, guildId));
  cache.set(guildId, { value: settings, expires: Date.now() + ttlMs });
  return settings;
}

export function forgetGuildSettings(guildId: string): void {
  cache.delete(guildId);
}

export async function updateGuildSettings(
  guildId: string,
  locale: string,
  changes: GuildSettingsUpdate,
): Promise<void> {
  await db
    .insert(schema.guilds)
    .values({ id: guildId, locale, ...changes })
    .onConflictDoUpdate({ target: schema.guilds.id, set: changes });
  cache.delete(guildId);
}

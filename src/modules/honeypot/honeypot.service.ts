import { eq, isNotNull } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema } from '@/db';

export interface HoneypotConfig {
  channelId: string;
  deleteMessageSeconds: number;
}

@Injectable()
export class HoneypotService {
  private readonly cache = new Map<string, HoneypotConfig>();

  async load(): Promise<void> {
    const rows = await db
      .select({
        guildId: schema.guilds.id,
        channelId: schema.guilds.honeypotChannelId,
        deleteMessageSeconds: schema.guilds.honeypotDeleteMessageSeconds,
      })
      .from(schema.guilds)
      .where(isNotNull(schema.guilds.honeypotChannelId));
    this.cache.clear();
    for (const { guildId, channelId, deleteMessageSeconds } of rows) {
      if (channelId) this.cache.set(guildId, { channelId, deleteMessageSeconds });
    }
  }

  get(guildId: string): HoneypotConfig | undefined {
    return this.cache.get(guildId);
  }

  async set(guildId: string, locale: string, config: HoneypotConfig): Promise<void> {
    const values = {
      honeypotChannelId: config.channelId,
      honeypotDeleteMessageSeconds: config.deleteMessageSeconds,
    };
    await db
      .insert(schema.guilds)
      .values({ id: guildId, locale, ...values })
      .onConflictDoUpdate({ target: schema.guilds.id, set: values });
    this.cache.set(guildId, config);
  }

  async clear(guildId: string): Promise<void> {
    await db
      .update(schema.guilds)
      .set({ honeypotChannelId: null })
      .where(eq(schema.guilds.id, guildId));
    this.cache.delete(guildId);
  }

  forget(guildId: string): void {
    this.cache.delete(guildId);
  }
}

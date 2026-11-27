import type { Message } from 'discord.js';
import { eq } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema } from '@/db';
import { t } from '@/i18n';

type CountingState = typeof schema.countingChannels.$inferSelect;

const table = schema.countingChannels;

@Injectable()
export class CountingService {
  private readonly states = new Map<string, CountingState | null>();
  private readonly queues = new Map<string, Promise<void>>();

  async configure(guildId: string, channelId: string | null): Promise<void> {
    if (channelId) {
      await db
        .insert(table)
        .values({ guildId, channelId })
        .onConflictDoUpdate({
          target: table.guildId,
          set: { channelId, current: 0, lastUserId: null },
        });
    } else {
      await db.delete(table).where(eq(table.guildId, guildId));
    }
    this.states.delete(guildId);
  }

  handle(message: Message<true>): Promise<void> {
    const previous = this.queues.get(message.guildId) ?? Promise.resolve();
    const next = previous.then(() => this.count(message));
    this.queues.set(
      message.guildId,
      next.catch(() => undefined),
    );
    return next;
  }

  private async state(guildId: string): Promise<CountingState | null> {
    if (!this.states.has(guildId)) {
      const [row] = await db.select().from(table).where(eq(table.guildId, guildId));
      this.states.set(guildId, row ?? null);
    }
    return this.states.get(guildId) ?? null;
  }

  private async count(message: Message<true>): Promise<void> {
    const state = await this.state(message.guildId);
    if (!state || state.channelId !== message.channelId) return;
    const content = message.content.trim();
    if (!/^\d+$/.test(content)) return;

    const value = Number(content);
    const sameUser = state.lastUserId === message.author.id;
    if (value === state.current + 1 && !sameUser) {
      const next = {
        ...state,
        current: value,
        lastUserId: message.author.id,
        record: Math.max(state.record, value),
      };
      this.states.set(message.guildId, next);
      await db.update(table).set(next).where(eq(table.guildId, message.guildId));
      await message.react('✅').catch(() => undefined);
      return;
    }

    const reset = { ...state, current: 0, lastUserId: null };
    this.states.set(message.guildId, reset);
    await db.update(table).set(reset).where(eq(table.guildId, message.guildId));
    await message.react('❌').catch(() => undefined);
    await message.channel
      .send({
        content: t(message.guild.preferredLocale, sameUser ? 'counting.twice' : 'counting.broken', {
          user: message.author.toString(),
          count: state.current,
          record: state.record,
        }),
        allowedMentions: { users: [message.author.id] },
      })
      .catch(() => undefined);
  }

  async purgeGuild(guildId: string): Promise<void> {
    await this.configure(guildId, null);
  }
}

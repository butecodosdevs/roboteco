import type { Client, Message } from 'discord.js';
import { cache } from '@/cache';
import { Injectable } from '@/core';

/**
 * A message to scan again later. `attempt` indexes `recheckDelaysMs`.
 * Stored in a Valkey sorted set as `guild:channel:message:attempt`, scored by when it is due.
 */
export interface Recheck {
  guildId: string;
  channelId: string;
  messageId: string;
  attempt: number;
}

/** After posting, a clean message is scanned again at these delays, as databases catch up. */
export const recheckDelaysMs = [60 * 60_000, 24 * 60 * 60_000];

const key = 'safety:rechecks';
// The set is refreshed on every add; it outlives the longest delay so nothing due is dropped.
const keyTtlSeconds = Math.ceil(Math.max(...recheckDelaysMs) / 1000) + 3600;

const encode = (recheck: Recheck) =>
  [recheck.guildId, recheck.channelId, recheck.messageId, recheck.attempt].join(':');

function decode(entry: string): Recheck | null {
  const [guildId, channelId, messageId, attempt] = entry.split(':');
  if (!guildId || !channelId || !messageId || !attempt) return null;
  return { guildId, channelId, messageId, attempt: Number(attempt) };
}

/** The queue of pending rechecks. Valkey is disposable, so a lost recheck is acceptable. */
@Injectable()
export class RechecksService {
  /** Queues the recheck that follows `attempt` (null for a new message). None follows the last one. */
  async scheduleAfter(message: Message<true>, attempt: number | null): Promise<void> {
    const next = attempt === null ? 0 : attempt + 1;
    const delay = recheckDelaysMs[next];
    if (delay === undefined) return;

    const entry = encode({
      guildId: message.guildId,
      channelId: message.channelId,
      messageId: message.id,
      attempt: next,
    });
    await cache
      .multi()
      .zadd(key, Date.now() + delay, entry)
      .expire(key, keyTtlSeconds)
      .exec()
      .catch(() => undefined);
  }

  /** Claims the rechecks that are due. ZREM makes each claim exclusive, so each runs once. */
  async takeDue(limit: number): Promise<Recheck[]> {
    const claimed: Recheck[] = [];

    for (const entry of await cache.zrangebyscore(key, 0, Date.now(), 'LIMIT', 0, limit)) {
      if ((await cache.zrem(key, entry)) === 0) continue;
      const recheck = decode(entry);
      if (recheck) claimed.push(recheck);
    }

    return claimed;
  }

  /** The message a recheck is for, or null when it, its channel or the server is gone. */
  async message(client: Client<true>, recheck: Recheck): Promise<Message<true> | null> {
    const guild = client.guilds.cache.get(recheck.guildId);
    const channel = await guild?.channels.fetch(recheck.channelId).catch(() => null);
    if (!channel?.isTextBased()) return null;

    const message = await channel.messages.fetch(recheck.messageId).catch(() => null);
    return message?.inGuild() ? message : null;
  }

  async forgetGuild(guildId: string): Promise<void> {
    const entries = (await cache.zrange(key, 0, -1)).filter((entry) =>
      entry.startsWith(`${guildId}:`),
    );
    if (entries.length > 0) await cache.zrem(key, ...entries);
  }
}

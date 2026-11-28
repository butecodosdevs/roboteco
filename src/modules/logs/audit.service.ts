import {
  AuditLogEvent,
  type Guild,
  type GuildAuditLogsEntry,
  PermissionFlagsBits,
} from 'discord.js';
import { cache } from '@/cache';
import { Injectable } from '@/core';
import { logger } from '@/logger';

/** Who did something, according to the audit log. */
export interface Actor {
  id: string;
  reason: string | null;
}

// The audit entry is written alongside the gateway event; anything older belongs to an earlier action.
const freshMs = 10_000;
// Discord folds repeats of some actions (message deletes, voice moves and disconnects by the same
// moderator) into one entry and only bumps its count, so the last count seen per entry is kept to
// notice the bump.
const countTtlSeconds = 15 * 60;
const countKey = (guildId: string, entryId: string) => `logs:audit:count:${guildId}:${entryId}`;

type CountedExtra = { channel?: { id: string }; count?: number } | null;

type Entry = GuildAuditLogsEntry;

/** An audit entry `/dev emit` pretends Discord wrote, so attribution can be tried without a second account. */
export interface SimulatedEntry {
  action: AuditLogEvent;
  targetId: string;
  executorId: string;
  reason?: string | null;
  extra?: unknown;
  changes?: { key: string }[];
}

@Injectable()
export class AuditService {
  private readonly simulated = new Map<string, Entry[]>();
  private simulatedCount = 0;

  /** Development only: makes the next lookups in `guildId` see `entry` as a fresh audit entry. */
  simulate(guildId: string, entry: SimulatedEntry): void {
    const now = Date.now();
    const kept = (this.simulated.get(guildId) ?? []).filter(
      (e) => e.createdTimestamp > now - freshMs,
    );
    const fake = {
      id: `simulated-${now}-${++this.simulatedCount}`,
      createdTimestamp: now,
      reason: null,
      extra: null,
      changes: [],
      ...entry,
    } as unknown as Entry;
    this.simulated.set(guildId, [fake, ...kept]);
  }

  canRead(guild: Guild): boolean {
    return guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog) ?? false;
  }

  /** The most recent matching entry for `targetId`, written in the last few seconds. */
  async find(
    guild: Guild,
    actions: AuditLogEvent[],
    targetId: string,
    match: (entry: Entry) => boolean = () => true,
  ): Promise<Actor | null> {
    const entries = await this.fetch(guild, actions);
    const since = Date.now() - freshMs;
    const entry = entries.find(
      (e) =>
        actions.includes(e.action) &&
        e.targetId === targetId &&
        e.createdTimestamp >= since &&
        match(e),
    );
    return entry ? toActor(entry) : null;
  }

  /**
   * Who deleted someone else's message in `channelId`. Null when the audit log has no entry, which
   * is what happens when authors delete their own messages.
   */
  messageDeleter(guild: Guild, authorId: string, channelId: string): Promise<Actor | null> {
    return this.counted(
      guild,
      AuditLogEvent.MessageDelete,
      (e, extra) => e.targetId === authorId && extra?.channel?.id === channelId,
    );
  }

  /** Who moved a member into `channelId`. Null when they switched channels themselves. */
  voiceMover(guild: Guild, channelId: string): Promise<Actor | null> {
    return this.counted(
      guild,
      AuditLogEvent.MemberMove,
      (_, extra) => extra?.channel?.id === channelId,
    );
  }

  /** Who disconnected a member from voice. Null when they left on their own. */
  voiceDisconnecter(guild: Guild): Promise<Actor | null> {
    return this.counted(guild, AuditLogEvent.MemberDisconnect, () => true);
  }

  /**
   * The entry of a folded action that just happened: a fresh entry not yet credited to an event, or
   * one whose count went up since it last was. The count is stored per entry when it gets credited,
   * and for entries too old to credit, so later bumps can be told apart.
   */
  private async counted(
    guild: Guild,
    action: AuditLogEvent,
    match: (entry: Entry, extra: CountedExtra) => boolean,
  ): Promise<Actor | null> {
    const entries = await this.fetch(guild, [action]);
    if (entries.length === 0) return null;
    const since = Date.now() - freshMs;
    const count = (e: Entry) => (e.extra as CountedExtra)?.count ?? 1;
    try {
      const keys = entries.map((e) => countKey(guild.id, e.id));
      const credited = await cache.mget(...keys);
      const index = entries.findIndex((e, i) => {
        if (!match(e, e.extra as CountedExtra)) return false;
        const seen = credited[i];
        return seen == null ? e.createdTimestamp >= since : count(e) > Number(seen);
      });
      const writes = cache.multi();
      entries.forEach((e, i) => {
        if (i === index || (credited[i] == null && e.createdTimestamp < since)) {
          writes.set(keys[i] as string, count(e), 'EX', countTtlSeconds);
        }
      });
      await writes.exec();
      const entry = entries[index];
      return entry ? toActor(entry) : null;
    } catch (error) {
      logger.warn({ err: error, guild: guild.id, action }, 'Could not match a folded audit entry');
      return null;
    }
  }

  private async fetch(guild: Guild, actions: AuditLogEvent[]): Promise<Entry[]> {
    if (!this.canRead(guild)) return [];
    const type = actions.length === 1 ? actions[0] : undefined;
    const logs = await guild
      .fetchAuditLogs({ type, limit: type === undefined ? 25 : 10 })
      .catch(() => null);
    const real = logs ? [...logs.entries.values()] : [];
    const simulated = (this.simulated.get(guild.id) ?? []).filter(
      (e) => type === undefined || e.action === type,
    );
    return simulated.length > 0 ? [...simulated, ...real] : real;
  }
}

function toActor(entry: Entry): Actor | null {
  return entry.executorId ? { id: entry.executorId, reason: entry.reason } : null;
}

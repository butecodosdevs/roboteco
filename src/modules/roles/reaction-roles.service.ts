import { and, eq } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema } from '@/db';

export type ReactionRole = typeof schema.reactionRoles.$inferSelect;
export interface EmojiRolePair {
  emoji: string;
  reaction: string;
  roleId: string;
}

const table = schema.reactionRoles;
export const maxReactionsPerMessage = 20;

const customEmoji = /^<(a?):(\w{2,32}):(\d{15,21})>$/;
const unicodeEmoji = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u;
const roleToken = /^(?:<@&(\d{15,21})>|(\d{15,21}))$/;
const messageLink = /channels\/(\d{15,21}|@me)\/(\d{15,21})\/(\d{15,21})/;

export function parseEmoji(token: string): string | undefined {
  const custom = customEmoji.exec(token);
  if (custom) return custom[3];
  return unicodeEmoji.test(token) ? token : undefined;
}

/** `emoji` is how reactions identify it (custom emoji ID or the unicode text); `reaction` is what to react with. */
export function parsePairs(input: string): { pairs: EmojiRolePair[]; invalid: string[] } {
  const tokens = input.split(/[\s,]+/).filter(Boolean);
  const pairs: EmojiRolePair[] = [];
  const invalid: string[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const emojiToken = tokens[i] ?? '';
    const roleMatch = roleToken.exec(tokens[i + 1] ?? '');
    const custom = customEmoji.exec(emojiToken);
    const emoji = custom
      ? (custom[3] as string)
      : unicodeEmoji.test(emojiToken)
        ? emojiToken
        : undefined;
    if (!emoji || !roleMatch) {
      invalid.push([emojiToken, tokens[i + 1]].filter(Boolean).join(' '));
      continue;
    }
    pairs.push({ emoji, reaction: emojiToken, roleId: (roleMatch[1] ?? roleMatch[2]) as string });
  }
  return { pairs, invalid };
}

export function parseMessageRef(
  value: string,
): { channelId?: string; messageId: string } | undefined {
  const link = messageLink.exec(value);
  if (link) return { channelId: link[2], messageId: link[3] as string };
  return /^\d{15,21}$/.test(value.trim()) ? { messageId: value.trim() } : undefined;
}

export const emojiKey = (emoji: { id: string | null; name: string | null }) =>
  emoji.id ?? emoji.name ?? '';

@Injectable()
export class ReactionRolesService {
  // Reaction events fire constantly in busy servers; only the messages listed here are looked at.
  private readonly byMessage = new Map<string, Map<string, string>>();

  async load(): Promise<void> {
    this.byMessage.clear();
    for (const row of await db.select().from(table)) this.remember(row);
  }

  roleFor(messageId: string, emoji: string): string | undefined {
    return this.byMessage.get(messageId)?.get(emoji);
  }

  count(messageId: string): number {
    return this.byMessage.get(messageId)?.size ?? 0;
  }

  async add(row: Omit<ReactionRole, 'createdAt'>): Promise<void> {
    await db
      .insert(table)
      .values(row)
      .onConflictDoUpdate({ target: [table.messageId, table.emoji], set: { roleId: row.roleId } });
    this.remember(row);
  }

  async remove(guildId: string, messageId: string, emoji?: string): Promise<ReactionRole[]> {
    const removed = await db
      .delete(table)
      .where(
        and(
          eq(table.guildId, guildId),
          eq(table.messageId, messageId),
          emoji ? eq(table.emoji, emoji) : undefined,
        ),
      )
      .returning();
    for (const row of removed) this.byMessage.get(row.messageId)?.delete(row.emoji);
    if (this.count(messageId) === 0) this.byMessage.delete(messageId);
    return removed;
  }

  async forget(messageId: string): Promise<void> {
    if (!this.byMessage.has(messageId)) return;
    this.byMessage.delete(messageId);
    await db.delete(table).where(eq(table.messageId, messageId));
  }

  async list(guildId: string): Promise<ReactionRole[]> {
    return db.select().from(table).where(eq(table.guildId, guildId));
  }

  async purgeGuild(guildId: string): Promise<void> {
    const removed = await db.delete(table).where(eq(table.guildId, guildId)).returning();
    for (const row of removed) this.byMessage.delete(row.messageId);
  }

  private remember(row: Pick<ReactionRole, 'messageId' | 'emoji' | 'roleId'>): void {
    const map = this.byMessage.get(row.messageId) ?? new Map<string, string>();
    map.set(row.emoji, row.roleId);
    this.byMessage.set(row.messageId, map);
  }
}

import { and, eq, isNotNull, or } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema, userScope } from '@/db';

export type Birthday = typeof schema.birthdays.$inferSelect;

const birthdays = schema.birthdays;
const daysIn = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const isValidDate = (month: number, day: number) =>
  month >= 1 && month <= 12 && day >= 1 && day <= (daysIn[month - 1] ?? 0);

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export function nextMidnightUtc(from = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1));
}

@Injectable()
export class BirthdaysService {
  async set(guildId: string, userId: string, month: number, day: number): Promise<void> {
    await db
      .insert(birthdays)
      .values({ guildId, userId, month, day })
      .onConflictDoUpdate({ target: [birthdays.guildId, birthdays.userId], set: { month, day } });
  }

  async remove(guildId: string, userId: string): Promise<void> {
    await db
      .delete(birthdays)
      .where(and(eq(birthdays.guildId, guildId), eq(birthdays.userId, userId)));
  }

  async list(guildId: string): Promise<Birthday[]> {
    return db.select().from(birthdays).where(eq(birthdays.guildId, guildId));
  }

  async on(date: Date): Promise<Birthday[]> {
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const leapDay = month === 2 && day === 28 && !isLeap(date.getUTCFullYear());
    return db
      .select()
      .from(birthdays)
      .where(
        or(
          and(eq(birthdays.month, month), eq(birthdays.day, day)),
          leapDay ? and(eq(birthdays.month, 2), eq(birthdays.day, 29)) : undefined,
        ),
      );
  }

  async configuredGuilds(): Promise<
    { id: string; channelId: string | null; roleId: string | null }[]
  > {
    return db
      .select({
        id: schema.guilds.id,
        channelId: schema.guilds.birthdayChannelId,
        roleId: schema.guilds.birthdayRoleId,
      })
      .from(schema.guilds)
      .where(isNotNull(schema.guilds.birthdayChannelId));
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(birthdays).where(eq(birthdays.guildId, guildId));
  }

  async eraseUser(userId: string, guildId?: string): Promise<void> {
    await db
      .delete(birthdays)
      .where(userScope(birthdays.userId, userId, birthdays.guildId, guildId));
  }
}

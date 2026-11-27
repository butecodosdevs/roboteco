import { Injectable } from '@/core';
import { getGuildSettings, updateGuildSettings } from '@/db';

export interface ModerationSettings {
  logChannelId: string | null;
  dmUsers: boolean;
  escalationWarnings: number | null;
  escalationAction: 'timeout' | 'kick' | 'ban' | null;
  escalationDurationSeconds: number | null;
  warnExpiryDays: number;
}

@Injectable()
export class ModerationSettingsService {
  async get(guildId: string): Promise<ModerationSettings> {
    const settings = await getGuildSettings(guildId);
    return {
      logChannelId: settings?.moderationLogChannelId ?? null,
      dmUsers: settings?.moderationDmUsers ?? true,
      escalationWarnings: settings?.escalationWarnings ?? null,
      escalationAction: settings?.escalationAction ?? null,
      escalationDurationSeconds: settings?.escalationDurationSeconds ?? null,
      warnExpiryDays: settings?.warnExpiryDays ?? 30,
    };
  }

  async update(
    guildId: string,
    locale: string,
    changes: Partial<ModerationSettings>,
  ): Promise<void> {
    await updateGuildSettings(guildId, locale, {
      ...(changes.logChannelId !== undefined && { moderationLogChannelId: changes.logChannelId }),
      ...(changes.dmUsers !== undefined && { moderationDmUsers: changes.dmUsers }),
      ...(changes.escalationWarnings !== undefined && {
        escalationWarnings: changes.escalationWarnings,
      }),
      ...(changes.escalationAction !== undefined && { escalationAction: changes.escalationAction }),
      ...(changes.escalationDurationSeconds !== undefined && {
        escalationDurationSeconds: changes.escalationDurationSeconds,
      }),
      ...(changes.warnExpiryDays !== undefined && { warnExpiryDays: changes.warnExpiryDays }),
    });
  }
}

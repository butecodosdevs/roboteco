import type { Client } from 'discord.js';
import { inject, Job } from '@/core';
import { t } from '@/i18n';
import { ModerationService } from '../moderation.service';
import { TempBansService } from '../temp-bans.service';

export interface UnbanPayload {
  guildId: string;
  userId: string;
}

@Job('moderation.unban')
export class UnbanJob {
  async execute({ guildId, userId }: UnbanPayload, client: Client<true>) {
    const tempBans = inject(TempBansService);
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return tempBans.complete(guildId, userId);

    const banned = await guild.bans.fetch(userId).catch(() => null);
    if (banned) {
      const reason = t(guild.preferredLocale, 'moderation.tempBan.expired');
      const moderation = inject(ModerationService);
      await moderation.expect(guildId, 'unban', userId, client.user.id);
      await guild.members.unban(userId, reason);
      await moderation.recordAutomatic(guild, 'unban', banned.user, reason);
    }
    await tempBans.complete(guildId, userId);
  }
}

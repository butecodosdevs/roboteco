import type { Client } from 'discord.js';
import { inject, Job, schedule } from '@/core';
import { t } from '@/i18n';
import { logger, reportError } from '@/logger';
import { BirthdaysService, nextMidnightUtc } from '../birthdays.service';

@Job('birthdays.daily')
export class BirthdaysJob {
  async execute(_payload: Record<string, never>, client: Client<true>) {
    await schedule(BirthdaysJob, nextMidnightUtc(), {});
    try {
      await this.celebrate(client);
    } catch (error) {
      reportError(error, {}, 'Birthday run failed');
    }
  }

  private async celebrate(client: Client<true>) {
    const service = inject(BirthdaysService);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    const [todays, yesterdays] = await Promise.all([service.on(today), service.on(yesterday)]);

    for (const settings of await service.configuredGuilds()) {
      const guild = client.guilds.cache.get(settings.id);
      if (!guild) continue;
      const celebrants = todays.filter((b) => b.guildId === guild.id).map((b) => b.userId);

      if (settings.roleId && guild.roles.cache.has(settings.roleId)) {
        const roleId = settings.roleId;
        for (const b of yesterdays.filter(
          (b) => b.guildId === guild.id && !celebrants.includes(b.userId),
        )) {
          const member = await guild.members.fetch(b.userId).catch(() => null);
          await member?.roles.remove(roleId, 'Birthday over').catch(() => undefined);
        }
        for (const userId of celebrants) {
          const member = await guild.members.fetch(userId).catch(() => null);
          await member?.roles.add(roleId, 'Birthday').catch(() => undefined);
        }
      }

      if (celebrants.length === 0 || !settings.channelId) continue;
      const channel = await guild.channels.fetch(settings.channelId).catch(() => null);
      if (!channel?.isSendable()) continue;
      await channel.send({
        content: t(guild.preferredLocale, 'birthdays.announce', {
          users: celebrants.map((id) => `<@${id}>`).join(', '),
        }),
        allowedMentions: { users: celebrants },
      });
      logger.info({ guild: guild.id, count: celebrants.length }, 'Birthdays announced');
    }
  }
}

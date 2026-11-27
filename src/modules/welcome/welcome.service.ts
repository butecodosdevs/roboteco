import type { GuildMember } from 'discord.js';
import { Injectable } from '@/core';
import { getGuildSettings } from '@/db';
import { t } from '@/i18n';

@Injectable()
export class WelcomeService {
  render(member: GuildMember, template: string | null): string {
    const text = template ?? t(member.guild.preferredLocale, 'welcome.defaultMessage');
    const values: Record<string, string> = {
      user: member.toString(),
      server: member.guild.name,
      count: String(member.guild.memberCount),
    };
    return text.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
  }

  async greet(member: GuildMember): Promise<void> {
    const settings = await getGuildSettings(member.guild.id);
    if (!settings) return;

    if (settings.welcomeRoleId && member.guild.roles.cache.has(settings.welcomeRoleId)) {
      await member.roles.add(settings.welcomeRoleId, 'Join role').catch(() => undefined);
    }
    if (settings.welcomeChannelId) {
      const channel = await member.guild.channels
        .fetch(settings.welcomeChannelId)
        .catch(() => null);
      if (channel?.isSendable()) {
        await channel
          .send({
            content: this.render(member, settings.welcomeMessage),
            allowedMentions: { users: [member.id] },
          })
          .catch(() => undefined);
      }
    }
  }
}

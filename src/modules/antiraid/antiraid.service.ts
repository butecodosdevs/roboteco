import { type Guild, GuildVerificationLevel, PermissionFlagsBits } from 'discord.js';
import { Injectable, inject } from '@/core';
import { getGuildSettings, updateGuildSettings } from '@/db';
import { translator } from '@/i18n';
import { logger } from '@/logger';
import { ModLogService } from '@/modules/moderation/mod-log.service';

@Injectable()
export class AntiraidService {
  private readonly log = inject(ModLogService);
  private readonly joins = new Map<string, number[]>();

  async track(guild: Guild): Promise<void> {
    const settings = await getGuildSettings(guild.id);
    const threshold = settings?.antiraidJoins;
    if (!threshold || settings.antiraidLocked) return;

    const windowMs = settings.antiraidSeconds * 1000;
    const now = Date.now();
    const recent = (this.joins.get(guild.id) ?? []).filter((at) => now - at < windowMs);
    recent.push(now);
    this.joins.set(guild.id, recent);
    if (recent.length < threshold) return;

    this.joins.delete(guild.id);
    const locked = await this.lock(guild);
    if (!locked) return;
    const tr = translator(guild.preferredLocale);
    await this.log.postAlert(
      guild,
      tr('antiraid.alert.title'),
      tr('antiraid.alert.automatic', { count: recent.length, seconds: settings.antiraidSeconds }),
    );
    logger.warn({ guild: guild.id, joins: recent.length }, 'Raid lockdown triggered');
  }

  canLock(guild: Guild): boolean {
    return guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;
  }

  async lock(guild: Guild): Promise<boolean> {
    const settings = await getGuildSettings(guild.id);
    if (settings?.antiraidLocked || !this.canLock(guild)) return false;
    await updateGuildSettings(guild.id, guild.preferredLocale, {
      antiraidLocked: true,
      antiraidPreviousLevel: guild.verificationLevel,
    });
    await guild
      .disableInvites(true)
      .catch((error) => logger.warn({ err: error }, 'Could not pause invites'));
    if (guild.verificationLevel < GuildVerificationLevel.High) {
      await guild
        .setVerificationLevel(GuildVerificationLevel.High, 'Raid lockdown')
        .catch(() => undefined);
    }
    return true;
  }

  async unlock(guild: Guild): Promise<boolean> {
    const settings = await getGuildSettings(guild.id);
    if (!settings?.antiraidLocked) return false;
    await guild.disableInvites(false).catch(() => undefined);
    if (settings.antiraidPreviousLevel !== null) {
      await guild
        .setVerificationLevel(settings.antiraidPreviousLevel, 'Raid lockdown lifted')
        .catch(() => undefined);
    }
    await updateGuildSettings(guild.id, guild.preferredLocale, {
      antiraidLocked: false,
      antiraidPreviousLevel: null,
    });
    return true;
  }
}

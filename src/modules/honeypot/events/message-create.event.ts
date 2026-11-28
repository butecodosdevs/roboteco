import { Events, type Message, PermissionFlagsBits } from 'discord.js';
import { inject, On } from '@/core';
import { t } from '@/i18n';
import { logger } from '@/logger';
import { ModerationService } from '@/modules/moderation/moderation.service';
import { HoneypotService } from '../honeypot.service';

@On(Events.MessageCreate)
export class MessageCreateEvent {
  private readonly honeypots = inject(HoneypotService);
  private readonly moderation = inject(ModerationService);

  async execute(message: Message) {
    if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;

    const honeypot = this.honeypots.get(message.guildId);
    if (honeypot?.channelId !== message.channelId) return;

    const member =
      message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (member?.permissions.has(PermissionFlagsBits.ManageGuild)) return;
    if (member && !member.bannable) {
      logger.warn(
        { user: message.author.id, guild: message.guildId },
        'Honeypot: member cannot be banned',
      );
      return;
    }

    const reason = t(message.guild.preferredLocale, 'honeypot.banReason', {
      channel: message.channel.name,
    });
    await this.moderation.expect(message.guildId, 'ban', message.author.id, message.client.user.id);
    await message.guild.members.ban(message.author, {
      deleteMessageSeconds: honeypot.deleteMessageSeconds,
      reason,
    });
    if (honeypot.deleteMessageSeconds === 0) await message.delete().catch(() => {});
    await this.moderation.recordAutomatic(message.guild, 'ban', message.author, reason);
    logger.info({ user: message.author.id, guild: message.guildId }, 'Honeypot: banned');
  }
}

import { type Message, PermissionFlagsBits, Routes } from 'discord.js';
import { cache } from '@/cache';
import { Injectable, inject } from '@/core';
import type { GuildSettings } from '@/db';
import { translator } from '@/i18n';
import { logger } from '@/logger';
import { LogsService } from '@/modules/logs/logs.service';
import { ModLogService } from '@/modules/moderation/mod-log.service';
import { ModerationService } from '@/modules/moderation/moderation.service';
import type { Finding } from './scan.service';

/** What the bot managed to do about a message, for the moderation log. */
interface Outcome {
  deleted: boolean;
  timedOutMinutes: number | null;
  foundOnRecheck: boolean;
}

const claimTtlSeconds = 2 * 86_400;

/** Defanged so the log never turns a malicious link back into something clickable. */
const defang = (link: string) => link.replace(/^http/i, 'hxxp').replace(/\./g, '[.]');

// Findings are shown inside inline code, which a backtick or a newline would break.
const inlineCode = (text: string) => text.replace(/[`\n]/g, '').slice(0, 200);

/** Acts on a message with confirmed threats: delete, time out, report, tell the author. */
@Injectable()
export class RemovalService {
  private readonly moderation = inject(ModerationService);
  private readonly modLog = inject(ModLogService);
  private readonly logs = inject(LogsService);

  async remove(
    message: Message<true>,
    findings: Finding[],
    settings: GuildSettings,
    foundOnRecheck: boolean,
  ): Promise<void> {
    if (!(await this.claim(message))) return;

    const tr = translator(message.guild.preferredLocale);
    const sources = [...new Set(findings.map((f) => tr(`safety.sources.${f.threat.source}`)))];
    const reason = tr('safety.deleteReason', { sources: sources.join(', ') }).slice(0, 512);
    const lines = findings.map((finding) => this.describe(message.guild.preferredLocale, finding));

    const deleted = await this.delete(message, reason);
    const timedOutMinutes = await this.timeOut(message, settings, reason);
    await this.report(message, lines, { deleted, timedOutMinutes, foundOnRecheck });
    if (deleted && settings.moderationDmUsers) await this.tellAuthor(message, lines);

    logger.info(
      { guild: message.guildId, user: message.author.id, message: message.id, deleted, findings },
      'Safety: removed malicious content',
    );
  }

  /** A new message, its edit and its recheck can all find the threat; only the first acts. */
  private async claim(message: Message<true>): Promise<boolean> {
    const key = `safety:acted:${message.id}`;
    return (await cache.set(key, '1', 'EX', claimTtlSeconds, 'NX')) !== null;
  }

  private describe(locale: string, finding: Finding): string {
    const tr = translator(locale);
    const target = finding.kind === 'link' ? defang(finding.target) : finding.target;
    const via = finding.via ? ` → ${defang(finding.via)}` : '';
    return tr('safety.log.finding', {
      target: inlineCode(target + via),
      source: tr(`safety.sources.${finding.threat.source}`),
      detail: inlineCode(finding.threat.detail),
    });
  }

  /** Message#delete takes no reason, and the audit log should say why the bot removed it. */
  private async delete(message: Message<true>, reason: string): Promise<boolean> {
    await this.logs.expectMessageDelete(message.guildId, message.id, reason);
    return message.client.rest
      .delete(Routes.channelMessage(message.channelId, message.id), { reason })
      .then(() => true)
      .catch(() => false);
  }

  /**
   * The minutes applied, or null when none are configured or the author can't be timed out:
   * bots and webhooks, members with Manage Server, and members ranked above the bot.
   */
  private async timeOut(
    message: Message<true>,
    settings: GuildSettings,
    reason: string,
  ): Promise<number | null> {
    const minutes = settings.safetyTimeoutMinutes;
    const { guild, author } = message;
    if (!minutes || message.webhookId || author.bot) return null;

    const member = message.member ?? (await guild.members.fetch(author.id).catch(() => null));
    if (!member?.moderatable || member.permissions.has(PermissionFlagsBits.ManageGuild))
      return null;

    try {
      await this.moderation.expect(guild.id, 'timeout', author.id, guild.client.user.id);
      await member.timeout(minutes * 60_000, reason);
      await this.moderation.recordAutomatic(guild, 'timeout', author, reason, minutes * 60);
      return minutes;
    } catch (error) {
      logger.warn({ err: error, guild: guild.id, user: author.id }, 'Safety: timeout failed');
      return null;
    }
  }

  private async report(message: Message<true>, lines: string[], outcome: Outcome): Promise<void> {
    const tr = translator(message.guild.preferredLocale);
    const description = [
      tr('safety.log.author', { user: message.author.toString(), id: message.author.id }),
      tr('safety.log.channel', { channel: message.channel.toString() }),
      '',
      ...lines,
      '',
      outcome.foundOnRecheck ? tr('safety.log.recheck') : null,
      outcome.deleted ? null : tr('safety.log.notDeleted'),
      outcome.timedOutMinutes
        ? tr('safety.log.timedOut', { minutes: outcome.timedOutMinutes })
        : null,
    ].filter((line) => line !== null);

    await this.modLog.postAlert(
      message.guild,
      tr('safety.log.title'),
      description.join('\n').slice(0, 4000),
    );
  }

  /** Best effort: the author may have DMs closed, and a webhook or bot has no one to tell. */
  private async tellAuthor(message: Message<true>, lines: string[]): Promise<void> {
    if (message.webhookId || message.author.bot) return;
    const tr = translator(message.guild.preferredLocale);
    const content = tr('safety.dm', { server: message.guild.name, findings: lines.join('\n') });

    await message.author
      .send({ content: content.slice(0, 2000), allowedMentions: { parse: [] } })
      .catch(() => undefined);
  }
}

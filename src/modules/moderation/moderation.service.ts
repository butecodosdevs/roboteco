import {
  type Guild,
  type GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  type User,
} from 'discord.js';
import { cache } from '@/cache';
import { type GuildInteraction, type GuildModalInteraction, Injectable, inject } from '@/core';
import { type MessageKey, t, translator, type Vars } from '@/i18n';
import {
  type CaseAction,
  CasesService,
  formatDuration,
  type ModerationCase,
  type NewCase,
} from './cases.service';
import { ModLogService } from './mod-log.service';
import { ModerationSettingsService } from './moderation-settings.service';

export interface Refusal {
  key: MessageKey;
  vars?: Vars;
}

export type ModeratorInteraction = GuildInteraction | GuildModalInteraction;

export interface ModerationRequest {
  action: CaseAction;
  target: User;
  reason: string | null;
  durationSeconds?: number;
  requireMember?: boolean;
  check?: (member: GuildMember | null) => Promise<Refusal | undefined> | Refusal | undefined;
  run: (context: { member: GuildMember | null; auditReason: string }) => Promise<unknown>;
  onApplied?: (entry: ModerationCase) => Promise<string | undefined>;
}

const requiredPermission: Record<CaseAction, { flag: bigint; name: MessageKey }> = {
  warn: {
    flag: PermissionFlagsBits.ModerateMembers,
    name: 'moderation.permissions.moderateMembers',
  },
  timeout: {
    flag: PermissionFlagsBits.ModerateMembers,
    name: 'moderation.permissions.moderateMembers',
  },
  untimeout: {
    flag: PermissionFlagsBits.ModerateMembers,
    name: 'moderation.permissions.moderateMembers',
  },
  kick: { flag: PermissionFlagsBits.KickMembers, name: 'moderation.permissions.kickMembers' },
  ban: { flag: PermissionFlagsBits.BanMembers, name: 'moderation.permissions.banMembers' },
  unban: { flag: PermissionFlagsBits.BanMembers, name: 'moderation.permissions.banMembers' },
};

// The gateway event for an action the bot takes can arrive before the API call returns, so the
// mark is set first. Listeners (the server log) use it to avoid repeating what the case shows.
const handledTtlSeconds = 60;
/** Actions the bot announces before taking them. A purge is keyed by channel, the rest by member. */
export type ExpectedAction = CaseAction | 'purge';

const handledKey = (guildId: string, action: ExpectedAction, userId: string) =>
  `moderation:handled:${action}:${guildId}:${userId}`;

const notifyBeforeAction = new Set<CaseAction>(['kick', 'ban']);

export interface ModerationOutcome {
  entry: ModerationCase;
  notified: boolean;
  /** A line `onApplied` returned, e.g. when a temporary ban ends. */
  extra?: string;
  escalated?: ModerationCase;
}

@Injectable()
export class ModerationService {
  private readonly cases = inject(CasesService);
  private readonly log = inject(ModLogService);
  private readonly settings = inject(ModerationSettingsService);

  async apply(interaction: ModeratorInteraction, request: ModerationRequest) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const tr = translator(interaction.locale);
    const result = await this.perform(
      interaction.guild,
      interaction.member,
      request,
      interaction.locale,
    );
    if ('refusal' in result)
      return interaction.editReply(tr(result.refusal.key, result.refusal.vars));

    const { entry, notified, extra, escalated } = result;
    const lines = [
      tr('moderation.replies.done', {
        action: tr(`moderation.actions.${request.action}`),
        user: request.target.toString(),
        case: entry.number,
      }),
    ];
    if (!notified) lines.push(tr('moderation.replies.dmFailed'));
    if (extra) lines.push(extra);
    if (escalated) {
      lines.push(
        tr('moderation.escalation.applied', {
          action: tr(`moderation.actions.${escalated.action}`),
          case: escalated.number,
        }),
      );
    }
    return interaction.editReply(lines.join('\n'));
  }

  /**
   * Applies an action without an interaction: checks, DM, the action itself, the case and the
   * mod log, and warning escalation. `moderator` is the member acting, or null for the bot.
   * Refusal messages are translated into `locale`.
   */
  async perform(
    guild: Guild,
    moderator: GuildMember | null,
    request: ModerationRequest,
    locale: string,
  ): Promise<{ refusal: Refusal } | ModerationOutcome> {
    const { action, target } = request;
    const actor = moderator?.user ?? guild.client.user;

    const permission = requiredPermission[action];
    if (!guild.members.me?.permissions.has(permission.flag)) {
      return {
        refusal: {
          key: 'moderation.errors.botPermission',
          vars: { permission: t(locale, permission.name) },
        },
      };
    }

    const member = await guild.members.fetch(target.id).catch(() => null);
    const refusal =
      this.checkTarget(guild, moderator, target, member, request.requireMember ?? false) ??
      (await request.check?.(member));
    if (refusal) return { refusal };

    const reasonText = request.reason ?? t(guild.preferredLocale, 'moderation.log.noReason');
    const auditReason = `${actor.tag}: ${reasonText}`.slice(0, 512);
    const { dmUsers } = await this.settings.get(guild.id);
    const notify = dmUsers && action !== 'unban';

    let notified = !notify;
    if (notify && notifyBeforeAction.has(action)) notified = await this.notify(guild, request);
    await this.expect(guild.id, action, target.id, actor.id);
    await request.run({ member, auditReason });
    if (notify && !notifyBeforeAction.has(action)) notified = await this.notify(guild, request);

    const entry = await this.record(guild, {
      guildId: guild.id,
      action,
      targetId: target.id,
      moderatorId: actor.id,
      reason: request.reason,
      durationSeconds: request.durationSeconds ?? null,
    });
    const extra = await request.onApplied?.(entry);
    const escalated = action === 'warn' ? await this.escalate(guild, target, member) : undefined;
    return { entry, notified, extra, escalated };
  }

  recordAutomatic(
    guild: Guild,
    action: CaseAction,
    target: User,
    reason: string,
    durationSeconds: number | null = null,
  ) {
    return this.record(guild, {
      guildId: guild.id,
      action,
      targetId: target.id,
      moderatorId: guild.client.user.id,
      reason,
      durationSeconds,
    });
  }

  /** Marks an action the bot is about to take, with who asked for it. */
  async expect(
    guildId: string,
    action: ExpectedAction,
    userId: string,
    moderatorId: string,
  ): Promise<void> {
    await cache.set(handledKey(guildId, action, userId), moderatorId, 'EX', handledTtlSeconds);
  }

  /** The moderator behind an action the bot just took, or null when it happened outside the bot. */
  async consumeExpected(
    guildId: string,
    action: ExpectedAction,
    userId: string,
  ): Promise<string | null> {
    return cache.getdel(handledKey(guildId, action, userId));
  }

  private async escalate(
    guild: Guild,
    target: User,
    member: GuildMember | null,
  ): Promise<ModerationCase | undefined> {
    const settings = await this.settings.get(guild.id);
    const threshold = settings.escalationWarnings;
    const action = settings.escalationAction;
    if (!threshold || !action || !member) return undefined;

    const since =
      settings.warnExpiryDays > 0
        ? new Date(Date.now() - settings.warnExpiryDays * 86_400_000)
        : new Date(0);
    const warnings = await this.cases.countWarnings(guild.id, target.id, since);
    if (warnings === 0 || warnings % threshold !== 0) return undefined;

    const reason = t(guild.preferredLocale, 'moderation.escalation.reason', { count: warnings });
    const auditReason = `${guild.client.user.tag}: ${reason}`.slice(0, 512);
    const duration = settings.escalationDurationSeconds ?? 3600;
    await this.expect(guild.id, action, target.id, guild.client.user.id);
    if (action === 'timeout') {
      if (!member.moderatable) return undefined;
      await member.timeout(duration * 1000, auditReason);
    } else if (action === 'kick') {
      if (!member.kickable) return undefined;
      await member.kick(auditReason);
    } else {
      if (!member.bannable) return undefined;
      await guild.members.ban(target, { reason: auditReason });
    }
    return this.record(guild, {
      guildId: guild.id,
      action,
      targetId: target.id,
      moderatorId: guild.client.user.id,
      reason,
      durationSeconds: action === 'timeout' ? duration : null,
    });
  }

  private async record(guild: Guild, input: NewCase): Promise<ModerationCase> {
    const entry = await this.cases.create(input, guild.preferredLocale);
    await this.log.postCase(guild, entry);
    return entry;
  }

  private checkTarget(
    guild: Guild,
    moderator: GuildMember | null,
    target: User,
    member: GuildMember | null,
    requireMember: boolean,
  ): Refusal | undefined {
    const user = target.toString();
    if (moderator && target.id === moderator.id) return { key: 'moderation.errors.self' };
    if (target.id === guild.client.user.id) return { key: 'moderation.errors.bot' };
    if (target.id === guild.ownerId) return { key: 'moderation.errors.owner' };
    if (!member)
      return requireMember ? { key: 'moderation.errors.notMember', vars: { user } } : undefined;

    const outranks =
      !moderator ||
      moderator.id === guild.ownerId ||
      moderator.roles.highest.comparePositionTo(member.roles.highest) > 0;
    if (!outranks) return { key: 'moderation.errors.hierarchy', vars: { user } };

    const me = guild.members.me;
    if (!me || me.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
      return { key: 'moderation.errors.botHierarchy', vars: { user } };
    }
    return undefined;
  }

  private async notify(guild: Guild, request: ModerationRequest): Promise<boolean> {
    if (request.action === 'unban') return true;
    const locale = guild.preferredLocale;
    const duration = request.durationSeconds ? formatDuration(locale, request.durationSeconds) : '';
    const lines = [t(locale, `moderation.dm.${request.action}`, { server: guild.name, duration })];
    if (request.reason) lines.push(t(locale, 'moderation.dm.reason', { reason: request.reason }));
    return request.target
      .send(lines.join('\n'))
      .then(() => true)
      .catch(() => false);
  }
}

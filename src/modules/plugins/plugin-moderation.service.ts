import { type GuildMember, PermissionFlagsBits, type User } from 'discord.js';
import { z } from 'zod';
import { CapabilityError, Expose, Injectable, inject, type PluginScope, snowflake } from '@/core';
import { t } from '@/i18n';
import type { CaseAction } from '@/modules/moderation/cases.service';
import { type ModerationRequest, ModerationService } from '@/modules/moderation/moderation.service';
import { TempBansService } from '@/modules/moderation/temp-bans.service';
import { DiscordDataService } from './discord-data.service';

const reason = z.string().min(1).max(400);
// Optional reasons: an empty string means none, as a blank Discord option would.
const optionalReason = z
  .string()
  .max(400)
  .optional()
  .transform((r) => r || undefined);
const outcome = z.object({
  case: z.number(),
  /** False when the member had DMs closed and was not told. */
  notified: z.boolean(),
  /** The case a warning escalated into (the server's automatic punishment), if any. */
  escalatedCase: z.number().nullable(),
});
type Outcome = z.infer<typeof outcome>;

/**
 * Moderation for plugins, through the same `ModerationService` the commands use: the same checks,
 * DMs, cases, mod log and escalation. With a caller, the caller is the moderator and must have the
 * command's permission and outrank the target. Without one (events, scheduled runs), the bot is.
 */
@Injectable()
export class PluginModerationService {
  private readonly discord = inject(DiscordDataService);
  private readonly moderation = inject(ModerationService);
  private readonly tempBans = inject(TempBansService);

  @Expose('moderation.warn', {
    permission: 'moderation.act',
    caller: PermissionFlagsBits.ModerateMembers,
    description: 'Warn a member; counts towards the server’s escalation',
    input: z.object({ userId: snowflake, reason }),
    output: outcome,
  })
  warn(scope: PluginScope, input: { userId: string; reason: string }) {
    return this.act(scope, input.userId, (target) => ({
      action: 'warn',
      target,
      reason: input.reason,
      requireMember: true,
      run: async () => {},
    }));
  }

  @Expose('moderation.timeout', {
    permission: 'moderation.act',
    caller: PermissionFlagsBits.ModerateMembers,
    description: 'Time a member out for 1 minute to 28 days',
    input: z.object({
      userId: snowflake,
      minutes: z.number().int().min(1).max(40_320),
      reason: optionalReason,
    }),
    output: outcome,
  })
  timeout(scope: PluginScope, input: { userId: string; minutes: number; reason?: string }) {
    return this.act(scope, input.userId, (target) => ({
      action: 'timeout',
      target,
      reason: input.reason ?? null,
      durationSeconds: input.minutes * 60,
      requireMember: true,
      check: (member) =>
        member?.moderatable
          ? undefined
          : { key: 'moderation.errors.cannotTimeout', vars: { user: target.toString() } },
      run: async ({ member, auditReason }) => {
        await member?.timeout(input.minutes * 60_000, auditReason);
      },
    }));
  }

  @Expose('moderation.untimeout', {
    permission: 'moderation.act',
    caller: PermissionFlagsBits.ModerateMembers,
    description: "Remove a member's timeout",
    input: z.object({ userId: snowflake, reason: optionalReason }),
    output: outcome,
  })
  untimeout(scope: PluginScope, input: { userId: string; reason?: string }) {
    return this.act(scope, input.userId, (target) => ({
      action: 'untimeout',
      target,
      reason: input.reason ?? null,
      requireMember: true,
      check: (member) =>
        member?.isCommunicationDisabled()
          ? undefined
          : { key: 'moderation.errors.notTimedOut', vars: { user: target.toString() } },
      run: async ({ member, auditReason }) => {
        await member?.timeout(null, auditReason);
      },
    }));
  }

  @Expose('moderation.kick', {
    permission: 'moderation.act',
    caller: PermissionFlagsBits.KickMembers,
    description: 'Kick a member',
    input: z.object({ userId: snowflake, reason: optionalReason }),
    output: outcome,
  })
  kick(scope: PluginScope, input: { userId: string; reason?: string }) {
    return this.act(scope, input.userId, (target) => ({
      action: 'kick',
      target,
      reason: input.reason ?? null,
      requireMember: true,
      run: async ({ member, auditReason }) => {
        await member?.kick(auditReason);
      },
    }));
  }

  @Expose('moderation.ban', {
    permission: 'moderation.act',
    caller: PermissionFlagsBits.BanMembers,
    description:
      'Ban a user. For a temporary ban, schedule a moderation.unban with schedule.create',
    input: z.object({
      userId: snowflake,
      reason: optionalReason,
      deleteMessageSeconds: z.number().int().min(0).max(604_800).default(0),
    }),
    output: outcome,
  })
  ban(
    scope: PluginScope,
    input: { userId: string; reason?: string; deleteMessageSeconds: number },
  ) {
    const guild = this.discord.guild(scope);
    return this.act(scope, input.userId, (target) => ({
      action: 'ban',
      target,
      reason: input.reason ?? null,
      check: async () => {
        const banned = await guild.bans.fetch(target.id).catch(() => null);
        return banned
          ? { key: 'moderation.errors.alreadyBanned', vars: { user: target.toString() } }
          : undefined;
      },
      run: ({ auditReason }) =>
        guild.members.ban(target, {
          reason: auditReason,
          deleteMessageSeconds: input.deleteMessageSeconds,
        }),
    }));
  }

  @Expose('moderation.unban', {
    permission: 'moderation.act',
    caller: PermissionFlagsBits.BanMembers,
    description: 'Lift a ban',
    input: z.object({ userId: snowflake, reason: optionalReason }),
    output: outcome,
  })
  unban(scope: PluginScope, input: { userId: string; reason?: string }) {
    const guild = this.discord.guild(scope);
    return this.act(scope, input.userId, (target) => ({
      action: 'unban',
      target,
      reason: input.reason ?? null,
      check: async () => {
        const banned = await guild.bans.fetch(target.id).catch(() => null);
        return banned
          ? undefined
          : { key: 'moderation.errors.notBanned', vars: { user: target.toString() } };
      },
      run: async ({ auditReason }) => {
        await guild.members.unban(target, auditReason);
        await this.tempBans.cancel(guild.id, target.id);
      },
    }));
  }

  private async act(
    scope: PluginScope,
    userId: string,
    request: (target: User) => ModerationRequest & { action: CaseAction },
  ): Promise<Outcome> {
    const guild = this.discord.guild(scope);
    const target = await guild.client.users.fetch(userId).catch(() => null);
    if (!target) throw new CapabilityError('not_found', 'no Discord user with that ID');
    let moderator: GuildMember | null = null;
    if (scope.caller) {
      moderator = await guild.members.fetch(scope.caller.userId).catch(() => null);
      if (!moderator) throw new CapabilityError('caller_forbidden', 'the caller left the server');
    }
    const built = request(target);
    // Cases say which plugin acted, so staff can tell plugin actions from their own.
    const result = await this.moderation.perform(
      guild,
      moderator,
      { ...built, reason: `${built.reason ?? ''} (plugin ${scope.pluginId})`.trim() },
      guild.preferredLocale,
    );
    if ('refusal' in result) {
      throw new CapabilityError(
        'refused',
        t(guild.preferredLocale, result.refusal.key, result.refusal.vars),
      );
    }
    return {
      case: result.entry.number,
      notified: result.notified,
      escalatedCase: result.escalated?.number ?? null,
    };
  }
}

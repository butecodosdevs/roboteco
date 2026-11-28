import {
  AuditLogEvent,
  type Client,
  Collection,
  Events,
  type Guild,
  GuildBan,
  type GuildMember,
  type GuildTextBasedChannel,
  type Message,
  type NonThreadGuildBasedChannel,
  type Role,
  type User,
  type VoiceBasedChannel,
  type VoiceState,
} from 'discord.js';
import type { SimulatedEntry } from '@/modules/logs/audit.service';

/** Scenarios per `/dev` subcommand, so each one only offers the options that apply to it. */
export const groups = {
  message: ['messageEdit', 'messageDelete', 'messageBulkDelete'],
  member: [
    'memberJoin',
    'memberLeave',
    'memberKick',
    'memberNickname',
    'memberRoles',
    'memberTimeout',
    'memberBoost',
    'memberBan',
    'memberUnban',
  ],
  channel: ['channelCreate', 'channelDelete', 'channelUpdate'],
  role: ['roleCreate', 'roleDelete', 'roleUpdate'],
  voice: ['voiceJoin', 'voiceLeave', 'voiceDisconnect', 'voiceMove', 'voiceMute', 'voiceDeafen'],
} as const;

export type Scenario = (typeof groups)[keyof typeof groups][number];

export type TargetOption = 'channel' | 'author' | 'count' | 'member' | 'role';

/**
 * The target options each scenario reads; anything else the caller filled in is reported as unused.
 * `actor` and `reason` apply whenever Discord would write an audit entry for the event.
 */
export const uses: Record<Scenario, TargetOption[]> = {
  messageEdit: ['channel', 'author'],
  messageDelete: ['channel', 'author'],
  messageBulkDelete: ['channel', 'author', 'count'],
  memberJoin: ['member'],
  memberLeave: ['member'],
  memberKick: ['member'],
  memberNickname: ['member'],
  memberRoles: ['member', 'role'],
  memberTimeout: ['member'],
  memberBoost: ['member'],
  memberBan: ['member'],
  memberUnban: ['member'],
  channelCreate: ['channel'],
  channelDelete: ['channel'],
  channelUpdate: ['channel'],
  roleCreate: ['role'],
  roleDelete: ['role'],
  roleUpdate: ['role'],
  voiceJoin: ['member', 'channel'],
  voiceLeave: ['member', 'channel'],
  voiceDisconnect: ['member', 'channel'],
  voiceMove: ['member', 'channel'],
  voiceMute: ['member', 'channel'],
  voiceDeafen: ['member', 'channel'],
};

/** What a scenario acts on, picked from the command options with the caller as the fallback. */
export interface Targets {
  client: Client<true>;
  guild: Guild;
  member: GuildMember;
  /** Where message scenarios read messages from. */
  textChannel: GuildTextBasedChannel | null;
  /** The channel channel scenarios act on. */
  channel: NonThreadGuildBasedChannel | null;
  author: User | null;
  /** The voice channel voice scenarios happen in: the picked one, else the member's current one. */
  voiceChannel: VoiceBasedChannel | null;
  role: Role | null;
  count: number;
}

/** A gateway event to fire, plus the audit entry Discord would have written for it. */
export interface Emission {
  event: Events;
  args: unknown[];
  audit?: Omit<SimulatedEntry, 'executorId' | 'reason'>;
}

export class ScenarioError extends Error {
  constructor(
    readonly key:
      | 'noMessage'
      | 'noTextChannel'
      | 'noRole'
      | 'noChannel'
      | 'noVoiceChannel'
      | 'noOtherVoiceChannel',
  ) {
    super(key);
  }
}

// discord.js builds the `before` side of an update event by cloning the cached structure, then
// patching it. Doing the same gives listeners the objects they would get from Discord.
const clone = <T extends object>(value: T): T => (value as T & { _clone(): T })._clone();

const recentLimit = 50;

async function recentMessages(t: Targets): Promise<Message<true>[]> {
  if (!t.textChannel) throw new ScenarioError('noTextChannel');
  const recent = await t.textChannel.messages.fetch({ limit: recentLimit });
  return [...recent.values()].filter((m) =>
    t.author ? m.author.id === t.author.id : !m.author.bot && !m.system,
  );
}

async function latestMessage(t: Targets): Promise<Message<true>> {
  const [message] = await recentMessages(t);
  if (!message) throw new ScenarioError('noMessage');
  return message;
}

function fakeBan(client: Client<true>, guild: Guild, user: User, reason: string | null): GuildBan {
  return Object.assign(Object.create(GuildBan.prototype) as GuildBan, {
    client,
    guild,
    user,
    reason,
  });
}

/** Two copies of the member's voice state, so before and after can differ without touching the real one. */
function voiceStates(member: GuildMember, edit: (before: VoiceState, after: VoiceState) => void) {
  const before = clone(member.voice);
  const after = clone(member.voice);
  edit(before, after);
  return [before, after];
}

export async function build(scenario: Scenario, t: Targets): Promise<Emission> {
  const { member, guild } = t;
  switch (scenario) {
    case 'messageEdit': {
      const after = await latestMessage(t);
      const before = clone(after);
      before.content = `${after.content} (before the simulated edit)`;
      return { event: Events.MessageUpdate, args: [before, after] };
    }
    case 'messageDelete': {
      const message = await latestMessage(t);
      return {
        event: Events.MessageDelete,
        args: [message],
        audit: {
          action: AuditLogEvent.MessageDelete,
          targetId: message.author.id,
          extra: { channel: { id: message.channelId }, count: 1 },
        },
      };
    }
    case 'messageBulkDelete': {
      const picked = (await recentMessages(t)).slice(0, t.count);
      if (picked.length === 0 || !t.textChannel) throw new ScenarioError('noMessage');
      const messages = new Collection(picked.map((m) => [m.id, m]));
      return {
        event: Events.MessageBulkDelete,
        args: [messages, t.textChannel],
        audit: {
          action: AuditLogEvent.MessageBulkDelete,
          targetId: t.textChannel.id,
          extra: { count: messages.size },
        },
      };
    }
    case 'memberJoin':
      return { event: Events.GuildMemberAdd, args: [member] };
    case 'memberLeave':
      return { event: Events.GuildMemberRemove, args: [member] };
    case 'memberKick':
      return {
        event: Events.GuildMemberRemove,
        args: [member],
        audit: { action: AuditLogEvent.MemberKick, targetId: member.id },
      };
    case 'memberNickname': {
      const before = clone(member);
      before.nickname = member.nickname ? null : 'simulated-old-nick';
      return {
        event: Events.GuildMemberUpdate,
        args: [before, member],
        audit: {
          action: AuditLogEvent.MemberUpdate,
          targetId: member.id,
          changes: [{ key: 'nick' }],
        },
      };
    }
    case 'memberRoles': {
      if (!t.role || t.role.id === guild.id) throw new ScenarioError('noRole');
      const roleId = t.role.id;
      const before = clone(member);
      const current = (member as unknown as { _roles: string[] })._roles;
      // Has the role now: show it as just added. Lacks it: show it as just removed.
      (before as unknown as { _roles: string[] })._roles = current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId];
      return {
        event: Events.GuildMemberUpdate,
        args: [before, member],
        audit: { action: AuditLogEvent.MemberRoleUpdate, targetId: member.id },
      };
    }
    case 'memberTimeout': {
      const before = clone(member);
      const after = clone(member);
      before.communicationDisabledUntilTimestamp = null;
      after.communicationDisabledUntilTimestamp = Date.now() + 10 * 60 * 1000;
      return {
        event: Events.GuildMemberUpdate,
        args: [before, after],
        audit: {
          action: AuditLogEvent.MemberUpdate,
          targetId: member.id,
          changes: [{ key: 'communication_disabled_until' }],
        },
      };
    }
    case 'memberBoost': {
      const before = clone(member);
      const after = clone(member);
      before.premiumSinceTimestamp = null;
      after.premiumSinceTimestamp = Date.now();
      return { event: Events.GuildMemberUpdate, args: [before, after] };
    }
    case 'memberBan':
      return {
        event: Events.GuildBanAdd,
        args: [fakeBan(t.client, guild, member.user, null)],
        audit: { action: AuditLogEvent.MemberBanAdd, targetId: member.id },
      };
    case 'memberUnban':
      return {
        event: Events.GuildBanRemove,
        args: [fakeBan(t.client, guild, member.user, null)],
        audit: { action: AuditLogEvent.MemberBanRemove, targetId: member.id },
      };
    case 'channelCreate':
    case 'channelDelete': {
      if (!t.channel) throw new ScenarioError('noChannel');
      return {
        event: scenario === 'channelCreate' ? Events.ChannelCreate : Events.ChannelDelete,
        args: [t.channel],
        audit: {
          action:
            scenario === 'channelCreate'
              ? AuditLogEvent.ChannelCreate
              : AuditLogEvent.ChannelDelete,
          targetId: t.channel.id,
        },
      };
    }
    case 'channelUpdate': {
      if (!t.channel) throw new ScenarioError('noChannel');
      const before = clone(t.channel) as NonThreadGuildBasedChannel & {
        rateLimitPerUser?: number;
      };
      before.name = `${t.channel.name}-old`;
      if ('rateLimitPerUser' in before)
        before.rateLimitPerUser = (before.rateLimitPerUser ?? 0) + 30;
      return {
        event: Events.ChannelUpdate,
        args: [before, t.channel],
        audit: { action: AuditLogEvent.ChannelUpdate, targetId: t.channel.id },
      };
    }
    case 'roleCreate':
    case 'roleDelete': {
      if (!t.role || t.role.id === guild.id) throw new ScenarioError('noRole');
      return {
        event: scenario === 'roleCreate' ? Events.GuildRoleCreate : Events.GuildRoleDelete,
        args: [t.role],
        audit: {
          action: scenario === 'roleCreate' ? AuditLogEvent.RoleCreate : AuditLogEvent.RoleDelete,
          targetId: t.role.id,
        },
      };
    }
    case 'roleUpdate': {
      if (!t.role || t.role.id === guild.id) throw new ScenarioError('noRole');
      const before = clone(t.role);
      before.name = `${t.role.name}-old`;
      before.hoist = !t.role.hoist;
      return {
        event: Events.GuildRoleUpdate,
        args: [before, t.role],
        audit: { action: AuditLogEvent.RoleUpdate, targetId: t.role.id },
      };
    }
    case 'voiceJoin':
    case 'voiceLeave':
    case 'voiceDisconnect':
    case 'voiceMove':
    case 'voiceMute':
    case 'voiceDeafen': {
      const channel = t.voiceChannel;
      if (!channel) throw new ScenarioError('noVoiceChannel');
      if (scenario === 'voiceJoin') {
        return {
          event: Events.VoiceStateUpdate,
          args: voiceStates(member, (b, a) => {
            b.channelId = null;
            a.channelId = channel.id;
          }),
        };
      }
      if (scenario === 'voiceLeave' || scenario === 'voiceDisconnect') {
        return {
          event: Events.VoiceStateUpdate,
          args: voiceStates(member, (b, a) => {
            b.channelId = channel.id;
            a.channelId = null;
          }),
          audit:
            scenario === 'voiceDisconnect'
              ? { action: AuditLogEvent.MemberDisconnect, targetId: member.id, extra: { count: 1 } }
              : undefined,
        };
      }
      if (scenario === 'voiceMove') {
        const to = guild.channels.cache.find((c) => c.isVoiceBased() && c.id !== channel.id);
        if (!to) throw new ScenarioError('noOtherVoiceChannel');
        return {
          event: Events.VoiceStateUpdate,
          args: voiceStates(member, (b, a) => {
            b.channelId = channel.id;
            a.channelId = to.id;
          }),
          audit: {
            action: AuditLogEvent.MemberMove,
            targetId: member.id,
            extra: { channel: { id: to.id }, count: 1 },
          },
        };
      }
      const key = scenario === 'voiceMute' ? 'mute' : 'deaf';
      return {
        event: Events.VoiceStateUpdate,
        args: voiceStates(member, (b, a) => {
          b.channelId = channel.id;
          a.channelId = channel.id;
          if (key === 'mute') {
            b.serverMute = false;
            a.serverMute = true;
          } else {
            b.serverDeaf = false;
            a.serverDeaf = true;
          }
        }),
        audit: { action: AuditLogEvent.MemberUpdate, targetId: member.id, changes: [{ key }] },
      };
    }
  }
}

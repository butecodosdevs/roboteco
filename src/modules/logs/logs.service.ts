import {
  AttachmentBuilder,
  AuditLogEvent,
  ChannelType,
  escapeInlineCode,
  escapeMarkdown,
  type Guild,
  type GuildBan,
  type GuildMember,
  type Message,
  type NonThreadGuildBasedChannel,
  OverwriteType,
  type PartialGuildMember,
  type PartialMessage,
  type PermissionOverwrites,
  type ReadonlyCollection,
  type Role,
  type SendableChannels,
  type Snowflake,
  type VoiceState,
} from 'discord.js';
import { cache } from '@/cache';
import { Injectable, inject } from '@/core';
import { getGuildSettings, updateGuildSettings } from '@/db';
import { type MessageKey, translator } from '@/i18n';
import { InvitesService } from '@/modules/invites/invites.service';
import { type ExpectedAction, ModerationService } from '@/modules/moderation/moderation.service';
import { type Actor, AuditService } from './audit.service';

/** The event categories the server log can report. Also the i18n keys under `logs.events`. */
export const logEvents = [
  'messageEdit',
  'messageDelete',
  'messageBulkDelete',
  'memberJoin',
  'memberLeave',
  'memberUpdate',
  'memberBan',
  'memberUnban',
  'channelCreate',
  'channelDelete',
  'channelUpdate',
  'roleCreate',
  'roleDelete',
  'roleUpdate',
  'voiceJoin',
  'voiceLeave',
  'voiceMove',
  'voiceModeration',
] as const;

export type LogEvent = (typeof logEvents)[number];

const emojis: Record<LogEvent, string> = {
  messageEdit: '✏️',
  messageDelete: '🗑️',
  messageBulkDelete: '🧹',
  memberJoin: '📥',
  memberLeave: '📤',
  memberUpdate: '👤',
  memberBan: '🔨',
  memberUnban: '🕊️',
  channelCreate: '🆕',
  channelDelete: '❌',
  channelUpdate: '🛠️',
  roleCreate: '🆕',
  roleDelete: '❌',
  roleUpdate: '🛠️',
  voiceJoin: '🔊',
  voiceLeave: '🔈',
  voiceMove: '🔀',
  voiceModeration: '🔇',
};

// A plain message holds 2000 characters; quoted member text is kept short so one event stays one line.
const messageLimit = 2000;
const snippetLimit = 150;
const listLimit = 600;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Member-written text, flattened to one line and escaped so it can't pass for part of the log line. */
function quote(text: string, max = snippetLimit): string {
  return `"${escapeMarkdown(truncate(text.replace(/\s+/g, ' ').trim(), max))}"`;
}

const timestamp = (ms: number, style: 'R' | 'T' | 'F' = 'R') =>
  `<t:${Math.floor(ms / 1000)}:${style}>`;

/** A mention plus the username, for users who may no longer be in the server to resolve the mention. */
const named = (user: { id: string; username: string }) =>
  `<@${user.id}> (\`${escapeInlineCode(user.username)}\`)`;

/** "1h 20m", "4m 05s" or "12s". */
function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

// Long enough to cover any realistic voice session, so a leave can say how long the member stayed.
const voiceSessionTtlSeconds = 7 * 24 * 60 * 60;
const voiceSessionKey = (guildId: string, memberId: string) =>
  `logs:voice:session:${guildId}:${memberId}`;
// Features that move or disconnect members for someone mark it just before acting.
const voiceActionTtlSeconds = 60;
const voiceActionKey = (kind: VoiceAction, guildId: string, memberId: string) =>
  `logs:voice:${kind}:${guildId}:${memberId}`;

export type VoiceAction = 'move' | 'disconnect';

// A feature deleting a member's message marks it with its reason, so the log credits the bot with
// that reason even without View Audit Log.
const expectedDeleteTtlSeconds = 60;
const expectedDeleteKey = (guildId: string, messageId: string) =>
  `logs:expected-delete:${guildId}:${messageId}`;

// Accounts younger than this are flagged on join; most raid and spam accounts are days old.
const newAccountMs = 7 * 24 * 60 * 60 * 1000;

type Tr = ReturnType<typeof translator>;

interface Resolved {
  channel: SendableChannels;
  disabled: Set<string>;
  ignored: Set<string>;
}

/** One log line: its emoji (the event's by default) and the sentence. */
type Line = { emoji?: string; text: string };

interface Post {
  lines: Line[];
  files?: AttachmentBuilder[];
}

/** Where an event happened; threads are ignored with their parent channel. */
interface Source {
  channelId: string;
  parentId?: string | null;
  /** For moves: the event is hidden only when this channel is hidden too. */
  otherId?: string | null;
}

export const maxIgnoredChannels = 50;

function sourceOf(message: Message | PartialMessage): Source {
  const channel = 'channel' in message ? message.channel : undefined;
  return {
    channelId: message.channelId,
    parentId: channel?.isThread?.() ? channel.parentId : null,
  };
}

type ChannelWithOverwrites = NonThreadGuildBasedChannel & {
  permissionOverwrites?: { cache: Map<string, PermissionOverwrites> };
};

const permissionState = (overwrite: PermissionOverwrites | undefined, flag: string) =>
  overwrite?.allow.has(flag as never) ? '✅' : overwrite?.deny.has(flag as never) ? '❌' : '➖';

/** One entry per role or member whose overwrite changed, e.g. "<@&id>: SendMessages ➖→❌". */
function overwriteChanges(before: ChannelWithOverwrites, after: ChannelWithOverwrites): string[] {
  const old = before.permissionOverwrites?.cache ?? new Map<string, PermissionOverwrites>();
  const now = after.permissionOverwrites?.cache ?? new Map<string, PermissionOverwrites>();
  const lines: string[] = [];
  for (const id of new Set([...old.keys(), ...now.keys()])) {
    const a = old.get(id);
    const b = now.get(id);
    const flags = new Set([
      ...(a?.allow.toArray() ?? []),
      ...(a?.deny.toArray() ?? []),
      ...(b?.allow.toArray() ?? []),
      ...(b?.deny.toArray() ?? []),
    ]);
    const changes = [...flags]
      .map((flag) => [flag, permissionState(a, flag), permissionState(b, flag)] as const)
      .filter(([, from, to]) => from !== to)
      .map(([flag, from, to]) => `${flag} ${from}→${to}`);
    if (changes.length === 0) continue;
    const type = (b ?? a)?.type;
    const target =
      id === after.guild.id
        ? '@everyone'
        : type === OverwriteType.Member
          ? `<@${id}>`
          : `<@&${id}>`;
    lines.push(`${target}: ${changes.join(', ')}`);
  }
  return lines;
}

/** Reads a channel setting that only some channel types have, so before and after can be compared. */
function setting(channel: NonThreadGuildBasedChannel, key: string): unknown {
  return key in channel ? (channel as unknown as Record<string, unknown>)[key] : undefined;
}

function transcript(messages: ReadonlyCollection<Snowflake, Message | PartialMessage>): string {
  return [...messages.values()]
    .filter((m) => !m.partial)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((m) => {
      const files = m.attachments.map((a) => a.url).join(' ');
      const text = [m.content, files].filter(Boolean).join(' ');
      return `[${new Date(m.createdTimestamp).toISOString()}] ${m.author?.tag} (${m.author?.id}): ${text}`;
    })
    .join('\n');
}

@Injectable()
export class LogsService {
  private readonly moderation = inject(ModerationService);
  private readonly audit = inject(AuditService);
  private readonly invites = inject(InvitesService);

  /** For an action the bot just took: 'skip' when its case already shows in this channel, else who asked. */
  private async botAction(
    guild: Guild,
    action: ExpectedAction,
    targetId: string,
  ): Promise<'skip' | string | null> {
    const moderatorId = await this.moderation.consumeExpected(guild.id, action, targetId);
    if (!moderatorId) return null;
    const settings = await getGuildSettings(guild.id);
    const shared =
      settings?.moderationLogChannelId &&
      settings.moderationLogChannelId === settings.serverLogChannelId;
    return shared ? 'skip' : moderatorId;
  }

  private async resolve(guild: Guild): Promise<Resolved | null> {
    const settings = await getGuildSettings(guild.id);
    if (!settings?.serverLogChannelId) return null;
    const channel = await guild.channels.fetch(settings.serverLogChannelId).catch(() => null);
    if (!channel?.isSendable()) return null;
    return {
      channel,
      disabled: new Set(settings.serverLogDisabledEvents),
      ignored: new Set(settings.serverLogIgnoredChannels),
    };
  }

  /**
   * Posts what `build` returns when the event is enabled and the source channel is logged. `build`
   * runs only then, so audit log lookups are skipped for events nobody reads.
   */
  private async post(
    guild: Guild,
    event: LogEvent,
    source: Source | undefined,
    build: (tr: Tr) => Promise<Post | Line[] | null>,
  ): Promise<void> {
    const resolved = await this.resolve(guild);
    if (!resolved) return;
    if (resolved.disabled.has(event)) return;
    // Never log the log channel itself, or channels the staff chose to ignore: both only add noise.
    const hidden = (id: string | null | undefined) =>
      !!id && (id === resolved.channel.id || resolved.ignored.has(id));
    if (source && (hidden(source.channelId) || hidden(source.parentId))) {
      if (!source.otherId || hidden(source.otherId)) return;
    }
    const built = await build(translator(guild.preferredLocale));
    if (!built) return;
    const { lines, files } = Array.isArray(built) ? { lines: built, files: [] } : built;
    if (lines.length === 0) return;
    const time = timestamp(Date.now(), 'T');
    const content = lines
      .map((line) => `${line.emoji ?? emojis[event]} ${time} ${line.text}`)
      .join('\n');
    await resolved.channel
      .send({ content: truncate(content, messageLimit), files, allowedMentions: { parse: [] } })
      .catch(() => undefined);
  }

  /** "<@id>", or "<@moderator> (through roboteco)" when the bot acted on a moderator's behalf. */
  private actor(tr: Tr, guild: Guild, actor: Actor | null, via?: string | null): string | null {
    if (via && (!actor || actor.id === guild.client.user.id)) {
      return tr('logs.log.viaBot', { moderator: `<@${via}>` });
    }
    return actor ? `<@${actor.id}>` : null;
  }

  /**
   * The sentence for an action, with the actor when known: `${key}By` names them, `key` is passive.
   * The audit log reason goes at the end.
   */
  private sentence(
    tr: Tr,
    guild: Guild,
    key: string,
    vars: Record<string, string | number>,
    actor: Actor | null,
    via?: string | null,
  ): string {
    const who = this.actor(tr, guild, actor, via);
    const text = who
      ? tr(`logs.log.${key}By` as MessageKey, { ...vars, actor: who })
      : tr(`logs.log.${key}` as MessageKey, vars);
    return actor?.reason ? tr('logs.log.withReason', { text, reason: quote(actor.reason) }) : text;
  }

  /** Joins the sentence and its optional extras: "sentence · extra · extra". */
  private details(text: string, extras: unknown[]): string {
    const parts = extras.filter((e): e is string => typeof e === 'string' && e.length > 0);
    return [text, ...parts].join(' · ');
  }

  async messageEdited(
    before: Message | PartialMessage,
    after: Message | PartialMessage,
  ): Promise<void> {
    const message = after.partial ? await after.fetch().catch(() => null) : after;
    if (!message?.inGuild() || message.author.bot || message.system) return;
    const oldContent = before.partial ? null : before.content;
    const removed = before.partial
      ? []
      : [...before.attachments.filter((a) => !message.attachments.has(a.id)).values()];
    // Edits to embeds fire this event too; only report text changes and removed attachments.
    if (oldContent !== null && oldContent === message.content && removed.length === 0) return;

    await this.post(message.guild, 'messageEdit', sourceOf(message), async (tr) => {
      const after = message.content ? quote(message.content, 400) : tr('logs.log.noText');
      const vars = {
        author: `<@${message.author.id}>`,
        channel: `<#${message.channelId}>`,
        link: message.url,
        after,
      };
      const text =
        oldContent === null
          ? tr('logs.log.messageEditUnknown', vars)
          : tr('logs.log.messageEdit', {
              ...vars,
              before: oldContent ? quote(oldContent, 400) : tr('logs.log.noText'),
            });
      return [
        {
          text: this.details(text, [
            removed.length > 0 &&
              tr('logs.log.attachmentsRemoved', {
                files: removed.map((a) => escapeMarkdown(a.name)).join(', '),
              }),
          ]),
        },
      ];
    });
  }

  async messageDeleted(message: Message | PartialMessage): Promise<void> {
    const { guild } = message;
    if (!guild) return;
    if (message.author?.bot || message.system) return;
    const expected = await cache.getdel(expectedDeleteKey(guild.id, message.id)).catch(() => null);
    await this.post(guild, 'messageDelete', sourceOf(message), async (tr) => {
      const vars = {
        author: message.author ? `<@${message.author.id}>` : tr('logs.log.someone'),
        channel: `<#${message.channelId}>`,
        content: message.content
          ? quote(message.content, 400)
          : message.partial
            ? tr('logs.log.notCached')
            : tr('logs.log.noText'),
      };
      let text = tr('logs.log.messageDelete', vars);
      if (expected !== null) {
        const bot = { id: guild.client.user.id, reason: expected };
        text = this.sentence(tr, guild, 'messageDelete', vars, bot);
      } else if (message.author && this.audit.canRead(guild)) {
        const deleter = await this.audit.messageDeleter(
          guild,
          message.author.id,
          message.channelId,
        );
        text = deleter
          ? this.sentence(tr, guild, 'messageDelete', vars, deleter)
          : tr('logs.log.messageDeleteSelf', vars);
      }
      const reply = message.reference?.messageId
        ? `https://discord.com/channels/${guild.id}/${message.reference.channelId}/${message.reference.messageId}`
        : null;
      return [
        {
          text: this.details(text, [
            message.attachments.size > 0 &&
              tr('logs.log.attachments', {
                files: message.attachments.map((a) => escapeMarkdown(a.name)).join(', '),
              }),
            message.stickers.size > 0 &&
              tr('logs.log.stickers', {
                stickers: message.stickers.map((s) => escapeMarkdown(s.name)).join(', '),
              }),
            reply && tr('logs.log.replyTo', { link: reply }),
            message.createdTimestamp > 0 &&
              tr('logs.log.sent', { time: timestamp(message.createdTimestamp) }),
          ]),
        },
      ];
    });
  }

  async messagesBulkDeleted(
    guild: Guild,
    channelId: string,
    messages: ReadonlyCollection<Snowflake, Message | PartialMessage>,
    parentId: string | null = null,
  ): Promise<void> {
    const via = await this.botAction(guild, 'purge', channelId);
    if (via === 'skip') return;
    await this.post(guild, 'messageBulkDelete', { channelId, parentId }, async (tr) => {
      const actor = via
        ? null
        : await this.audit.find(guild, [AuditLogEvent.MessageBulkDelete], channelId);
      const perAuthor = new Map<string, number>();
      for (const m of messages.values()) {
        if (m.author) perAuthor.set(m.author.id, (perAuthor.get(m.author.id) ?? 0) + 1);
      }
      const authors = [...perAuthor]
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => `<@${id}> × ${n}`)
        .join(', ');
      const text = this.sentence(
        tr,
        guild,
        'messageBulkDelete',
        { count: messages.size, channel: `<#${channelId}>` },
        actor,
        via,
      );
      const lines = [
        {
          text: this.details(text, [
            authors && tr('logs.log.authors', { authors: truncate(authors, listLimit) }),
          ]),
        },
      ];
      const content = transcript(messages);
      if (!content) return lines;
      const file = new AttachmentBuilder(Buffer.from(content, 'utf8'), {
        name: `deleted-${channelId}.txt`,
      });
      return { lines, files: [file] };
    });
  }

  async memberJoined(member: GuildMember): Promise<void> {
    const invite = this.invites.inviteUsed(member);
    await this.post(member.guild, 'memberJoin', undefined, async (tr) => {
      const used = await invite;
      const isNew = Date.now() - member.user.createdTimestamp < newAccountMs;
      const text = tr('logs.log.memberJoin', { member: named(member.user) });
      return [
        {
          text: this.details(text, [
            tr('logs.log.accountCreated', { time: timestamp(member.user.createdTimestamp) }),
            isNew && tr('logs.log.newAccount'),
            used &&
              (used.inviterId
                ? tr('logs.log.invite', { code: used.code, inviter: `<@${used.inviterId}>` })
                : tr('logs.log.inviteNoInviter', { code: used.code })),
            tr('logs.log.memberCount', { count: member.guild.memberCount }),
          ]),
        },
      ];
    });
  }

  async memberLeft(member: GuildMember | PartialGuildMember): Promise<void> {
    const { guild } = member;
    await this.post(guild, 'memberLeave', undefined, async (tr) => {
      const via = await this.botAction(guild, 'kick', member.id);
      if (via === 'skip') return null;
      const kick = await this.audit.find(guild, [AuditLogEvent.MemberKick], member.id);
      const ban =
        kick || via ? null : await this.audit.find(guild, [AuditLogEvent.MemberBanAdd], member.id);
      const kicked = !!(kick || via);

      const roles = member.roles.cache.filter((role) => role.id !== guild.id);
      const vars = { member: named(member.user) };
      const text = kicked
        ? this.sentence(tr, guild, 'memberKick', vars, kick, via)
        : tr('logs.log.memberLeave', vars);
      return [
        {
          emoji: kicked ? '👢' : undefined,
          text: this.details(text, [
            ban && tr('logs.log.leftBanned', { actor: `<@${ban.id}>` }),
            member.joinedTimestamp &&
              tr('logs.log.joined', { time: timestamp(member.joinedTimestamp) }),
            roles.size > 0 &&
              tr('logs.log.hadRoles', {
                roles: truncate(roles.map((role) => role.toString()).join(' '), listLimit),
              }),
          ]),
        },
      ];
    });
  }

  async memberUpdated(before: GuildMember | PartialGuildMember, after: GuildMember): Promise<void> {
    // An uncached old member has nothing to compare against; diffing would report every role as
    // added after a restart.
    if (before.partial) return;
    const { guild } = after;

    const nickChanged = before.nickname !== after.nickname;
    const beforeRoles = before.roles.cache;
    const added = [...after.roles.cache.filter((r) => !beforeRoles.has(r.id)).values()];
    const removed = [...beforeRoles.filter((r) => !after.roles.cache.has(r.id)).values()];
    const beforeTimeout = before.communicationDisabledUntilTimestamp ?? null;
    const afterTimeout = after.communicationDisabledUntilTimestamp ?? null;
    const timeoutChanged = beforeTimeout !== afterTimeout;
    const boostChanged =
      (before.premiumSinceTimestamp ?? null) !== (after.premiumSinceTimestamp ?? null);
    const rolesChanged = added.length > 0 || removed.length > 0;
    // guildMemberUpdate also fires for avatars and flags; skip when nothing we track moved.
    if (!nickChanged && !rolesChanged && !timeoutChanged && !boostChanged) return;

    const timedOut = afterTimeout !== null && afterTimeout > Date.now();
    const via = timeoutChanged
      ? await this.botAction(guild, timedOut ? 'timeout' : 'untimeout', after.id)
      : null;
    if (via === 'skip' && !nickChanged && !rolesChanged && !boostChanged) return;

    await this.post(guild, 'memberUpdate', undefined, async (tr) => {
      const lines: Line[] = [];
      const member = `<@${after.id}>`;
      const changed = (key: string) => (e: { changes: { key: string }[] }) =>
        e.changes.some((c) => c.key === key);

      if (nickChanged) {
        const actor = await this.audit.find(
          guild,
          [AuditLogEvent.MemberUpdate],
          after.id,
          changed('nick'),
        );
        const none = tr('logs.log.none');
        const vars = {
          member,
          from: before.nickname ? quote(before.nickname) : none,
          to: after.nickname ? quote(after.nickname) : none,
        };
        const self = actor?.id === after.id;
        lines.push({
          emoji: '🏷️',
          text: self
            ? tr('logs.log.nicknameSelf', vars)
            : this.sentence(tr, guild, 'nickname', vars, actor),
        });
      }

      if (rolesChanged) {
        const actor = await this.audit.find(guild, [AuditLogEvent.MemberRoleUpdate], after.id);
        const list = (roles: Role[]) =>
          truncate(roles.map((r) => r.toString()).join(' '), listLimit);
        if (added.length > 0) {
          const vars = { member, roles: list(added) };
          lines.push({ emoji: '🎭', text: this.sentence(tr, guild, 'rolesAdded', vars, actor) });
        }
        if (removed.length > 0) {
          const vars = { member, roles: list(removed) };
          lines.push({ emoji: '🎭', text: this.sentence(tr, guild, 'rolesRemoved', vars, actor) });
        }
      }

      if (timeoutChanged && via !== 'skip') {
        const actor = via
          ? null
          : await this.audit.find(
              guild,
              [AuditLogEvent.MemberUpdate],
              after.id,
              changed('communication_disabled_until'),
            );
        const text = timedOut
          ? this.sentence(
              tr,
              guild,
              'timeout',
              { member, time: timestamp(afterTimeout, 'F') },
              actor,
              via,
            )
          : this.sentence(tr, guild, 'untimeout', { member }, actor, via);
        lines.push({ emoji: '⏳', text });
      }

      if (boostChanged) {
        lines.push({
          emoji: '💎',
          text: tr(
            after.premiumSinceTimestamp ? 'logs.log.boostStarted' : 'logs.log.boostStopped',
            {
              member,
            },
          ),
        });
      }
      return lines;
    });
  }

  async memberBanned(ban: GuildBan): Promise<void> {
    const via = await this.botAction(ban.guild, 'ban', ban.user.id);
    if (via === 'skip') return;
    await this.post(ban.guild, 'memberBan', undefined, async (tr) => {
      // The gateway event carries no reason; the audit entry has it.
      const actor = await this.audit.find(ban.guild, [AuditLogEvent.MemberBanAdd], ban.user.id);
      return [
        {
          text: this.sentence(tr, ban.guild, 'memberBan', { member: named(ban.user) }, actor, via),
        },
      ];
    });
  }

  async memberUnbanned(ban: GuildBan): Promise<void> {
    const via = await this.botAction(ban.guild, 'unban', ban.user.id);
    if (via === 'skip') return;
    await this.post(ban.guild, 'memberUnban', undefined, async (tr) => {
      const actor = await this.audit.find(ban.guild, [AuditLogEvent.MemberBanRemove], ban.user.id);
      return [
        {
          text: this.sentence(
            tr,
            ban.guild,
            'memberUnban',
            { member: named(ban.user) },
            actor,
            via,
          ),
        },
      ];
    });
  }

  async channelCreated(channel: NonThreadGuildBasedChannel): Promise<void> {
    await this.post(channel.guild, 'channelCreate', undefined, async (tr) => {
      const actor = await this.audit.find(channel.guild, [AuditLogEvent.ChannelCreate], channel.id);
      const vars = { channel: channel.toString(), type: ChannelType[channel.type] };
      return [
        {
          text: this.details(this.sentence(tr, channel.guild, 'channelCreate', vars, actor), [
            channel.parent &&
              tr('logs.log.inCategory', { category: escapeMarkdown(channel.parent.name) }),
          ]),
        },
      ];
    });
  }

  async channelDeleted(channel: NonThreadGuildBasedChannel): Promise<void> {
    await this.post(channel.guild, 'channelDelete', undefined, async (tr) => {
      const actor = await this.audit.find(channel.guild, [AuditLogEvent.ChannelDelete], channel.id);
      const vars = {
        channel: `#${escapeMarkdown(channel.name)}`,
        type: ChannelType[channel.type],
      };
      return [
        {
          text: this.details(this.sentence(tr, channel.guild, 'channelDelete', vars, actor), [
            channel.parent &&
              tr('logs.log.inCategory', { category: escapeMarkdown(channel.parent.name) }),
          ]),
        },
      ];
    });

    // A deleted log channel would otherwise keep the setting and silently stop logging.
    const settings = await getGuildSettings(channel.guild.id);
    const ignored = settings?.serverLogIgnoredChannels ?? [];
    if (settings && (settings.serverLogChannelId === channel.id || ignored.includes(channel.id))) {
      await updateGuildSettings(channel.guild.id, channel.guild.preferredLocale, {
        ...(settings.serverLogChannelId === channel.id && { serverLogChannelId: null }),
        serverLogIgnoredChannels: ignored.filter((id) => id !== channel.id),
      });
    }
  }

  async channelUpdated(
    before: NonThreadGuildBasedChannel,
    after: NonThreadGuildBasedChannel,
  ): Promise<void> {
    const tr = translator(after.guild.preferredLocale);
    const changes: string[] = [];
    const none = tr('logs.log.none');
    const change = (key: MessageKey, from: string, to: string) => tr(key, { from, to });

    if (before.name !== after.name) {
      changes.push(change('logs.log.changeName', quote(before.name), quote(after.name)));
    }
    const topic = (c: NonThreadGuildBasedChannel) => (setting(c, 'topic') as string | null) ?? '';
    if (topic(before) !== topic(after)) {
      const show = (t: string) => (t ? quote(t) : none);
      changes.push(change('logs.log.changeTopic', show(topic(before)), show(topic(after))));
    }
    if (before.parentId !== after.parentId) {
      const show = (c: NonThreadGuildBasedChannel) =>
        c.parent ? escapeMarkdown(c.parent.name) : none;
      changes.push(change('logs.log.changeCategory', show(before), show(after)));
    }
    const slowmode = (c: NonThreadGuildBasedChannel) => Number(setting(c, 'rateLimitPerUser') ?? 0);
    if (slowmode(before) !== slowmode(after)) {
      const show = (s: number) => (s === 0 ? tr('logs.log.off') : `${s}s`);
      changes.push(
        change('logs.log.changeSlowmode', show(slowmode(before)), show(slowmode(after))),
      );
    }
    const yesNo = (v: unknown) => (v ? tr('logs.log.yes') : tr('logs.log.no'));
    if (!!setting(before, 'nsfw') !== !!setting(after, 'nsfw')) {
      changes.push(
        change(
          'logs.log.changeNsfw',
          yesNo(setting(before, 'nsfw')),
          yesNo(setting(after, 'nsfw')),
        ),
      );
    }
    const userLimit = (c: NonThreadGuildBasedChannel) => Number(setting(c, 'userLimit') ?? 0);
    if (userLimit(before) !== userLimit(after)) {
      const show = (n: number) => (n === 0 ? tr('logs.log.unlimited') : String(n));
      changes.push(
        change('logs.log.changeUserLimit', show(userLimit(before)), show(userLimit(after))),
      );
    }
    const overwrites = overwriteChanges(before, after);
    if (overwrites.length > 0) {
      changes.push(tr('logs.log.changeOverwrites', { changes: overwrites.join('; ') }));
    }

    // Channel updates also fire for position tweaks; skip when nothing tracked changed.
    if (changes.length === 0) return;

    await this.post(after.guild, 'channelUpdate', undefined, async () => {
      const actions = [
        ...(overwrites.length > 0
          ? [
              AuditLogEvent.ChannelOverwriteCreate,
              AuditLogEvent.ChannelOverwriteUpdate,
              AuditLogEvent.ChannelOverwriteDelete,
            ]
          : []),
        ...(changes.length > (overwrites.length > 0 ? 1 : 0) ? [AuditLogEvent.ChannelUpdate] : []),
      ];
      const actor = await this.audit.find(after.guild, actions, after.id);
      const vars = { channel: after.toString(), changes: changes.join(', ') };
      return [{ text: this.sentence(tr, after.guild, 'channelUpdate', vars, actor) }];
    });
  }

  async roleCreated(role: Role): Promise<void> {
    await this.post(role.guild, 'roleCreate', undefined, async (tr) => {
      const actor = await this.audit.find(role.guild, [AuditLogEvent.RoleCreate], role.id);
      return [
        { text: this.sentence(tr, role.guild, 'roleCreate', { role: role.toString() }, actor) },
      ];
    });
  }

  async roleDeleted(role: Role): Promise<void> {
    await this.post(role.guild, 'roleDelete', undefined, async (tr) => {
      const actor = await this.audit.find(role.guild, [AuditLogEvent.RoleDelete], role.id);
      const permissions = role.permissions.toArray();
      const vars = { role: `@${escapeMarkdown(role.name)}` };
      return [
        {
          text: this.details(this.sentence(tr, role.guild, 'roleDelete', vars, actor), [
            permissions.length > 0 &&
              tr('logs.log.hadPermissions', {
                permissions: truncate(permissions.join(', '), listLimit),
              }),
          ]),
        },
      ];
    });
  }

  async roleUpdated(before: Role, after: Role): Promise<void> {
    const tr = translator(after.guild.preferredLocale);
    const changes: string[] = [];
    const change = (key: MessageKey, from: string, to: string) => tr(key, { from, to });
    const yesNo = (v: boolean) => (v ? tr('logs.log.yes') : tr('logs.log.no'));

    if (before.name !== after.name) {
      changes.push(change('logs.log.changeName', quote(before.name), quote(after.name)));
    }
    if (before.color !== after.color) {
      changes.push(change('logs.log.changeColor', before.hexColor, after.hexColor));
    }
    if (before.hoist !== after.hoist) {
      changes.push(change('logs.log.changeHoist', yesNo(before.hoist), yesNo(after.hoist)));
    }
    if (before.mentionable !== after.mentionable) {
      changes.push(
        change('logs.log.changeMentionable', yesNo(before.mentionable), yesNo(after.mentionable)),
      );
    }
    const added = after.permissions.toArray().filter((p) => !before.permissions.has(p));
    const removed = before.permissions.toArray().filter((p) => !after.permissions.has(p));
    if (added.length > 0) {
      changes.push(tr('logs.log.permissionsAdded', { permissions: added.join(', ') }));
    }
    if (removed.length > 0) {
      changes.push(tr('logs.log.permissionsRemoved', { permissions: removed.join(', ') }));
    }

    // Role updates also fire for position changes; skip when nothing tracked changed.
    if (changes.length === 0) return;

    await this.post(after.guild, 'roleUpdate', undefined, async () => {
      const actor = await this.audit.find(after.guild, [AuditLogEvent.RoleUpdate], after.id);
      const vars = { role: after.toString(), changes: changes.join(', ') };
      return [{ text: this.sentence(tr, after.guild, 'roleUpdate', vars, actor) }];
    });
  }

  /** Marks a member's message the bot is about to delete, with the reason the log should show. */
  async expectMessageDelete(guildId: string, messageId: string, reason: string): Promise<void> {
    await cache
      .set(expectedDeleteKey(guildId, messageId), reason, 'EX', expectedDeleteTtlSeconds)
      .catch(() => undefined);
  }

  /** Marks a voice move or disconnect the bot is about to make for `onBehalfOf`. */
  async expectVoiceAction(
    guildId: string,
    kind: VoiceAction,
    memberId: string,
    onBehalfOf: string,
  ): Promise<void> {
    await cache
      .set(voiceActionKey(kind, guildId, memberId), onBehalfOf, 'EX', voiceActionTtlSeconds)
      .catch(() => undefined);
  }

  private consumeVoiceAction(kind: VoiceAction, guildId: string, memberId: string) {
    return cache.getdel(voiceActionKey(kind, guildId, memberId)).catch(() => null);
  }

  /** Starts a session in `channelId` (or ends it on null) and returns how long the last one lasted. */
  private async voiceSession(
    guildId: string,
    memberId: string,
    channelId: string | null,
  ): Promise<number | null> {
    const key = voiceSessionKey(guildId, memberId);
    const started = await (channelId
      ? cache.set(key, Date.now(), 'EX', voiceSessionTtlSeconds, 'GET')
      : cache.getdel(key)
    ).catch(() => null);
    return started ? Date.now() - Number(started) : null;
  }

  async voiceStateUpdated(before: VoiceState, after: VoiceState): Promise<void> {
    const member = after.member ?? before.member;
    if (!member || member.user.bot) return;
    if (before.channelId !== after.channelId) {
      await this.voiceChannelChanged(member, before.channelId, after.channelId);
    }
    const channelId = after.channelId ?? before.channelId;
    // Mute and deafen are null while the state is unknown; only a real flip is a change.
    if (channelId && before.serverMute != null && after.serverMute != null) {
      if (before.serverMute !== after.serverMute) {
        await this.voiceModerated(member, channelId, 'mute', after.serverMute);
      }
    }
    if (channelId && before.serverDeaf != null && after.serverDeaf != null) {
      if (before.serverDeaf !== after.serverDeaf) {
        await this.voiceModerated(member, channelId, 'deaf', after.serverDeaf);
      }
    }
  }

  private async voiceChannelChanged(
    member: GuildMember,
    from: string | null,
    to: string | null,
  ): Promise<void> {
    const { guild } = member;
    const stayed = await this.voiceSession(guild.id, member.id, to);
    const stayedText = (tr: Tr) =>
      stayed !== null && tr('logs.log.stayed', { duration: duration(stayed) });

    if (!from && to) {
      await this.post(guild, 'voiceJoin', { channelId: to }, async (tr) => [
        { text: tr('logs.log.voiceJoin', { member: `<@${member.id}>`, channel: `<#${to}>` }) },
      ]);
      return;
    }

    if (from && !to) {
      const via = await this.consumeVoiceAction('disconnect', guild.id, member.id);
      await this.post(guild, 'voiceLeave', { channelId: from }, async (tr) => {
        const actor = via ? null : await this.audit.voiceDisconnecter(guild);
        const vars = { member: `<@${member.id}>`, channel: `<#${from}>` };
        const byOther = (actor && actor.id !== member.id) || (via && via !== member.id);
        const text = byOther
          ? this.sentence(tr, guild, 'voiceDisconnect', vars, actor, via)
          : tr('logs.log.voiceLeave', vars);
        return [{ emoji: byOther ? '⛔' : undefined, text: this.details(text, [stayedText(tr)]) }];
      });
      return;
    }

    if (from && to) {
      const via = await this.consumeVoiceAction('move', guild.id, member.id);
      await this.post(guild, 'voiceMove', { channelId: from, otherId: to }, async (tr) => {
        const actor = via ? null : await this.audit.voiceMover(guild, to);
        const vars = { member: `<@${member.id}>`, from: `<#${from}>`, to: `<#${to}>` };
        const byOther = (actor && actor.id !== member.id) || (via && via !== member.id);
        const text = byOther
          ? this.sentence(tr, guild, 'voiceMove', vars, actor, via)
          : tr('logs.log.voiceMoveSelf', vars);
        return [{ text: this.details(text, [stayedText(tr)]) }];
      });
    }
  }

  private async voiceModerated(
    member: GuildMember,
    channelId: string,
    kind: 'mute' | 'deaf',
    on: boolean,
  ): Promise<void> {
    const { guild } = member;
    await this.post(guild, 'voiceModeration', { channelId }, async (tr) => {
      const actor = await this.audit.find(guild, [AuditLogEvent.MemberUpdate], member.id, (e) =>
        e.changes.some((c) => c.key === kind),
      );
      const key =
        kind === 'mute'
          ? on
            ? 'serverMute'
            : 'serverUnmute'
          : on
            ? 'serverDeafen'
            : 'serverUndeafen';
      const vars = { member: `<@${member.id}>`, channel: `<#${channelId}>` };
      return [{ emoji: on ? '🔇' : '🔊', text: this.sentence(tr, guild, key, vars, actor) }];
    });
  }
}

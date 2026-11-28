import { Collection, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import type { PluginScope } from '@/core';

/** A stand-in Discord server with only what the plugin capabilities read. */
export interface FakeServer {
  guild: any;
  role(id: string, position: number, permissions?: bigint[]): any;
  member(id: string, roles?: string[], extra?: Record<string, unknown>): any;
  channel(id: string, overrides?: Record<string, bigint[]>): any;
  sent: { channelId: string; payload: any }[];
  dms: { userId: string; payload: any }[];
  bans: Set<string>;
  timeouts: Map<string, number | null>;
  kicked: string[];
  roleChanges: string[];
  scope(
    caller?: { userId: string; permissions?: bigint[] } | null,
    channelId?: string,
  ): PluginScope;
}

let unique = 0;
export const uniqueGuildId = () =>
  `9${Date.now()}${String(++unique).padStart(3, '0')}`.slice(0, 19);

export function fakeServer(pluginId = 'test-plugin'): FakeServer {
  const id = uniqueGuildId();
  const roles = new Collection<string, any>();
  const members = new Collection<string, any>();
  const channels = new Collection<string, any>();
  const server: FakeServer = {
    guild: null,
    sent: [],
    dms: [],
    bans: new Set(),
    timeouts: new Map(),
    kicked: [],
    roleChanges: [],
    role(roleId, position, permissions = []) {
      const role = {
        id: roleId,
        name: `role-${roleId}`,
        color: 0,
        position,
        managed: false,
        permissions: new PermissionsBitField(permissions),
        comparePositionTo: (other: any) => position - other.position,
        toString: () => `<@&${roleId}>`,
      };
      roles.set(roleId, role);
      return role;
    },
    member(userId, roleIds = [], extra = {}) {
      const held = () => roleIds.map((r) => roles.get(r)).filter(Boolean);
      const everyone = roles.get(id);
      const member: any = {
        id: userId,
        guild: server.guild,
        user: {
          id: userId,
          tag: `user${userId}#0`,
          username: `user${userId}`,
          bot: false,
          send: async (payload: any) => {
            server.dms.push({ userId, payload });
          },
          toString: () => `<@${userId}>`,
        },
        displayName: `User ${userId}`,
        joinedAt: null,
        displayAvatarURL: () => '',
        get permissions() {
          let bits = 0n;
          for (const role of [everyone, ...held()]) if (role) bits |= role.permissions.bitfield;
          return new PermissionsBitField(bits);
        },
        roles: {
          get highest() {
            return held().sort((a, b) => b.position - a.position)[0] ?? everyone;
          },
          get cache() {
            return new Collection(held().map((r) => [r.id, r]));
          },
          add: async (role: any) => {
            const id = typeof role === 'string' ? role : role.id;
            roleIds.push(id);
            server.roleChanges.push(`+${id}:${userId}`);
          },
          remove: async (role: any) => {
            const id = typeof role === 'string' ? role : role.id;
            roleIds.splice(roleIds.indexOf(id), 1);
            server.roleChanges.push(`-${id}:${userId}`);
          },
        },
        moderatable: true,
        isCommunicationDisabled: () => (server.timeouts.get(userId) ?? null) !== null,
        timeout: async (ms: number | null) => {
          server.timeouts.set(userId, ms);
        },
        kick: async () => {
          server.kicked.push(userId);
          members.delete(userId);
        },
        send: async (payload: any) => {
          server.dms.push({ userId, payload });
        },
        ...extra,
      };
      members.set(userId, member);
      return member;
    },
    channel(channelId, overrides = {}) {
      const permissionsFor = (who: any) => {
        let bits = who.permissions.bitfield as bigint;
        const deny = overrides[who.id];
        if (deny) for (const flag of deny) bits &= ~flag;
        return new PermissionsBitField(bits);
      };
      const channel = {
        id: channelId,
        guildId: id,
        type: 0,
        name: `chan-${channelId}`,
        isTextBased: () => true,
        isThread: () => false,
        permissionsFor,
        send: async (payload: any) => {
          const messageId = `${channelId}${server.sent.length + 1}`.slice(0, 19);
          server.sent.push({ channelId, payload });
          return { id: messageId, channelId };
        },
        messages: {
          fetch: async (messageId: string) => ({
            id: messageId,
            edit: async (payload: any) => server.sent.push({ channelId, payload }),
            react: async () => undefined,
          }),
          delete: async () => undefined,
        },
      };
      channels.set(channelId, channel);
      return channel;
    },
    scope(caller = null, channelId = '100000000000000300') {
      return {
        pluginId,
        guildId: id,
        channelId,
        caller: caller && {
          userId: caller.userId,
          permissions: new PermissionsBitField(caller.permissions ?? []).bitfield,
        },
      };
    },
  };
  const client = {
    user: { id: '100000000000000999', tag: 'bot#0', toString: () => '<@bot>' },
    users: {
      fetch: async (userId: string) =>
        members.get(userId)?.user ?? {
          id: userId,
          tag: `user${userId}#0`,
          send: async () => undefined,
          toString: () => `<@${userId}>`,
        },
    },
    rest: { delete: async () => undefined },
  };
  server.guild = {
    id,
    name: 'Test server',
    ownerId: '100000000000000001',
    preferredLocale: 'en-US',
    client,
    roles: { cache: roles },
    channels: { fetch: async (channelId: string) => channels.get(channelId) ?? null },
    members: {
      fetch: async (userId: string) => {
        const found = members.get(userId);
        if (!found) throw new Error('Unknown Member');
        return found;
      },
      get me() {
        return members.get(client.user.id);
      },
      ban: async (user: any) => {
        server.bans.add(user.id);
      },
      unban: async (user: any) => {
        server.bans.delete(typeof user === 'string' ? user : user.id);
      },
    },
    bans: {
      fetch: async (userId: string) =>
        server.bans.has(userId)
          ? { user: { id: userId } }
          : Promise.reject(new Error('Unknown Ban')),
    },
  };
  // @everyone has the guild's ID; the bot sits on a high role that can do everything a bot needs.
  server.role(id, 0, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);
  server.role('100000000000000990', 50, [
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.ReadMessageHistory,
  ]);
  server.member(client.user.id, ['100000000000000990']);
  return server;
}

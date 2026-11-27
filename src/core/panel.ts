import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { Client } from 'discord.js';
import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { panelRoute } from './panel-routes';

export interface PanelEvent {
  client: Client;
  token?: string;
  method: string;
  body: unknown;
}

export const isPanelPath = (path: string) => path.startsWith('/api/panel');

const registryPath = resolve('plugins/registry.json');

const json = (response: ServerResponse, status: number, body: unknown) => {
  response
    .writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    .end(JSON.stringify(body));
};

function authorized(request: IncomingMessage, token?: string): boolean {
  if (!token) return false;
  return request.headers['x-panel-token'] === token;
}

const total = async (query: Promise<{ total: number }[]>) => (await query)[0]?.total ?? 0;

async function plugins() {
  const raw = await readFile(resolve(registryPath), 'utf8').catch(() => null);
  if (!raw) return [];
  const { plugins: list } = JSON.parse(raw) as {
    plugins: { id: string; wasm: string; permissions?: string[]; allowedHosts?: string[] }[];
  };
  return Promise.all(
    list.map(async (plugin) => ({
      ...plugin,
      present: await readFile(resolve(plugin.wasm)).then(
        () => true,
        () => false,
      ),
    })),
  );
}

async function summary(guildId: string) {
  const s = schema;
  const now = new Date();
  const caseColumns = {
    number: s.moderationCases.number,
    action: s.moderationCases.action,
    targetId: s.moderationCases.targetId,
    moderatorId: s.moderationCases.moderatorId,
    reason: s.moderationCases.reason,
    durationSeconds: s.moderationCases.durationSeconds,
    createdAt: s.moderationCases.createdAt,
  };
  const feedColumns = {
    title: s.feeds.title,
    url: s.feeds.url,
    channelId: s.feeds.channelId,
    failures: s.feeds.failures,
    lastCheckedAt: s.feeds.lastCheckedAt,
  };
  const [cases, feeds, leaders, counting, drops, hubs, byAction, counters] = await Promise.all([
    db
      .select(caseColumns)
      .from(s.moderationCases)
      .where(eq(s.moderationCases.guildId, guildId))
      .orderBy(desc(s.moderationCases.number))
      .limit(12),
    db.select(feedColumns).from(s.feeds).where(eq(s.feeds.guildId, guildId)).limit(20),
    db
      .select({ userId: s.memberLevels.userId, xp: s.memberLevels.xp, level: s.memberLevels.level })
      .from(s.memberLevels)
      .where(eq(s.memberLevels.guildId, guildId))
      .orderBy(desc(s.memberLevels.xp))
      .limit(8),
    db.select().from(s.countingChannels).where(eq(s.countingChannels.guildId, guildId)).limit(1),
    db.select().from(s.dropChannels).where(eq(s.dropChannels.guildId, guildId)),
    db.select().from(s.tempVoiceHubs).where(eq(s.tempVoiceHubs.guildId, guildId)),
    db
      .select({ action: s.moderationCases.action, total: count() })
      .from(s.moderationCases)
      .where(eq(s.moderationCases.guildId, guildId))
      .groupBy(s.moderationCases.action),
    Promise.all([
      total(
        db
          .select({ total: count() })
          .from(s.moderationCases)
          .where(eq(s.moderationCases.guildId, guildId)),
      ),
      total(
        db
          .select({ total: count() })
          .from(s.tickets)
          .where(and(eq(s.tickets.guildId, guildId), isNull(s.tickets.closedAt))),
      ),
      total(
        db
          .select({ total: count() })
          .from(s.reports)
          .where(and(eq(s.reports.guildId, guildId), eq(s.reports.status, 'open'))),
      ),
      total(
        db
          .select({ total: count() })
          .from(s.suggestions)
          .where(and(eq(s.suggestions.guildId, guildId), eq(s.suggestions.status, 'pending'))),
      ),
      total(
        db
          .select({ total: count() })
          .from(s.giveaways)
          .where(and(eq(s.giveaways.guildId, guildId), isNull(s.giveaways.endedAt))),
      ),
      total(
        db
          .select({ total: count() })
          .from(s.customCommands)
          .where(eq(s.customCommands.guildId, guildId)),
      ),
      total(
        db.select({ total: count() }).from(s.birthdays).where(eq(s.birthdays.guildId, guildId)),
      ),
      total(
        db
          .select({ total: count() })
          .from(s.memberLevels)
          .where(eq(s.memberLevels.guildId, guildId)),
      ),
      total(
        db.select({ total: count() }).from(s.inviteJoins).where(eq(s.inviteJoins.guildId, guildId)),
      ),
      total(
        db
          .select({ total: count() })
          .from(s.scheduledPosts)
          .where(and(eq(s.scheduledPosts.guildId, guildId), gt(s.scheduledPosts.nextRunAt, now))),
      ),
      total(
        db.select({ total: count() }).from(s.selfRoles).where(eq(s.selfRoles.guildId, guildId)),
      ),
      total(
        db
          .select({ total: count() })
          .from(s.starboardEntries)
          .where(eq(s.starboardEntries.guildId, guildId)),
      ),
    ]),
  ]);

  const [
    casesTotal,
    openTickets,
    openReports,
    pendingSuggestions,
    liveGiveaways,
    commands,
    birthdays,
    leveledMembers,
    invites,
    scheduledPosts,
    selfRoles,
    starboardEntries,
  ] = counters;

  return {
    guild: guildId,
    counters: {
      cases: casesTotal,
      openTickets,
      openReports,
      pendingSuggestions,
      liveGiveaways,
      feeds: feeds.length,
      failingFeeds: feeds.filter((f) => f.failures > 0).length,
      commands,
      birthdays,
      leveledMembers,
      invites,
      scheduledPosts,
      selfRoles,
      starboardEntries,
      drops: drops.length,
      hubs: hubs.length,
    },
    cases,
    byAction,
    feeds,
    leaders,
    counting: counting[0] ?? null,
    drops,
    hubs,
  };
}

export async function handlePanel(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  event: PanelEvent,
): Promise<void> {
  const { client, token, method, body } = event;
  if (!token) {
    json(response, 503, { error: 'disabled' });
    return;
  }
  if (!authorized(request, token)) {
    json(response, 401, { error: 'token' });
    return;
  }

  const [head, ...segments] = url.pathname.split('/').filter(Boolean).slice(2);
  if (head && head !== 'guilds') {
    const route = panelRoute(head);
    if (!route) {
      json(response, 404, { error: 'unknown route' });
      return;
    }
    try {
      const reply = await route({ segments, query: url.searchParams, method, body, client });
      json(response, reply.status ?? 200, reply.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      json(response, 400, { error: message });
    }
    return;
  }

  const guilds = [...client.guilds.cache.values()].map((guild) => ({
    id: guild.id,
    name: guild.name,
    members: guild.memberCount,
    icon: guild.iconURL({ size: 64 }),
  }));

  if (url.pathname === '/api/panel/guilds') {
    json(response, 200, {
      bot: client.user
        ? { tag: client.user.tag, avatar: client.user.displayAvatarURL({ size: 64 }) }
        : null,
      ping: client.ws.ping,
      guilds,
      plugins: await plugins(),
    });
    return;
  }

  const guildId = url.searchParams.get('guild') ?? guilds[0]?.id;
  if (!guildId) {
    json(response, 400, { error: 'no guild' });
    return;
  }
  json(response, 200, await summary(guildId));
}

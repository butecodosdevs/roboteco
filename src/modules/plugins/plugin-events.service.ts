import { Injectable, inject } from '@/core';
import { logger } from '@/logger';
import { type LoadedPlugin, PluginCallError, PluginEngineService } from './plugin-engine.service';
import {
  type EventInput,
  type GatewayEvent,
  gatewayEvents,
  messageContentPermission,
  type PluginEvent,
} from './plugin-manifest.service';
import { PluginRegistryService } from './plugin-registry.service';

export interface GatewayPacket {
  t?: string | null;
  d?: unknown;
}

type Json = Record<string, unknown>;

// Bulk syncs (THREAD_LIST_SYNC, big GUILD_UPDATEs) can be large; a plugin call takes JSON.
const maxPayloadBytes = 64 * 1024;
const contentFields = ['content', 'embeds', 'attachments', 'components', 'poll'];

function withoutContent(message: Json): Json {
  const copy: Json = { ...message };
  for (const field of contentFields) delete copy[field];
  if (copy.referenced_message && typeof copy.referenced_message === 'object') {
    copy.referenced_message = withoutContent(copy.referenced_message as Json);
  }
  if (Array.isArray(copy.message_snapshots)) {
    copy.message_snapshots = copy.message_snapshots.map((snapshot: Json) => ({
      ...snapshot,
      message: snapshot.message ? withoutContent(snapshot.message as Json) : snapshot.message,
    }));
  }
  return copy;
}

// What Discord withholds from bots without the Message Content intent.
const contentStrippers: Partial<Record<GatewayEvent, (data: Json) => Json>> = {
  MESSAGE_CREATE: withoutContent,
  MESSAGE_UPDATE: withoutContent,
  AUTO_MODERATION_ACTION_EXECUTION: ({ content: _, matched_content: __, ...rest }) => rest,
};

function actorIds(data: Json): unknown[] {
  const author = data.author as Json | undefined;
  const user = data.user as Json | undefined;
  const member = data.member as Json | undefined;
  return [author?.id, data.user_id, user?.id, (member?.user as Json | undefined)?.id];
}

@Injectable()
export class PluginEventsService {
  private readonly registry = inject(PluginRegistryService);
  private readonly engine = inject(PluginEngineService);

  async dispatch(
    event: PluginEvent,
    guildId: string,
    channelId: string | null,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.deliver(this.registry.subscribers(event), { event, guildId, channelId, data });
  }

  async gateway(packet: GatewayPacket, botId: string): Promise<void> {
    if (!packet.t || !Object.hasOwn(gatewayEvents, packet.t)) return;
    const event = packet.t as GatewayEvent;
    const subscribers = this.registry.all().filter((p) => p.discordEvents.includes(event));
    if (subscribers.length === 0 || !packet.d || typeof packet.d !== 'object') return;

    const data = packet.d as Json;
    // GUILD_UPDATE and GUILD_DELETE are the server itself, so its ID is `id`.
    const guildId =
      typeof data.guild_id === 'string'
        ? data.guild_id
        : event === 'GUILD_UPDATE' || event === 'GUILD_DELETE'
          ? data.id
          : undefined;
    if (typeof guildId !== 'string') return;
    // What the bot did itself (often at a plugin's request) would otherwise come straight back
    // to the plugin and loop.
    if (actorIds(data).includes(botId)) return;
    if (Buffer.byteLength(JSON.stringify(data)) > maxPayloadBytes) {
      logger.debug({ event, guild: guildId }, 'Gateway event too large for plugins');
      return;
    }

    const channelId = typeof data.channel_id === 'string' ? data.channel_id : null;
    const strip = contentStrippers[event];
    await Promise.all(
      subscribers.map((plugin) => {
        const readsContent = plugin.definition.permissions.includes(messageContentPermission);
        const payload = strip && !readsContent ? strip(data) : data;
        return this.deliver([plugin], { event, guildId, channelId, data: payload });
      }),
    );
  }

  private async deliver(plugins: LoadedPlugin[], input: EventInput): Promise<void> {
    await Promise.all(
      plugins.map(async (plugin) => {
        try {
          const delivered = await this.engine.event(plugin, input);
          if (!delivered) {
            logger.debug({ plugin: plugin.id, event: input.event }, 'Plugin event backlog full');
          }
        } catch (error) {
          if (!(error instanceof PluginCallError)) throw error;
          logger.warn({ plugin: plugin.id, event: input.event, err: error }, 'Plugin event failed');
        }
      }),
    );
  }
}

import { Injectable, inject } from '@/core';
import { logger } from '@/logger';
import { PluginCallError, PluginEngineService } from './plugin-engine.service';
import type { PluginEvent } from './plugin-manifest.service';
import { PluginRegistryService } from './plugin-registry.service';

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
    const subscribers = this.registry.subscribers(event);
    await Promise.all(
      subscribers.map(async (plugin) => {
        try {
          const delivered = await this.engine.event(plugin, { event, guildId, channelId, data });
          if (!delivered) logger.debug({ plugin: plugin.id, event }, 'Plugin event backlog full');
        } catch (error) {
          if (!(error instanceof PluginCallError)) throw error;
          logger.warn({ plugin: plugin.id, event, err: error }, 'Plugin event failed');
        }
      }),
    );
  }
}

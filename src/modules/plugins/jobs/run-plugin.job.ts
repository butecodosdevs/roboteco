import { inject, Job } from '@/core';
import { logger } from '@/logger';
import { PluginCallError, PluginEngineService } from '../plugin-engine.service';
import { PluginRegistryService } from '../plugin-registry.service';

export interface RunPluginPayload {
  pluginId: string;
  guildId: string;
  channelId: string | null;
  key: string | null;
  data: unknown;
}

@Job('plugins.run')
export class RunPluginJob {
  async execute(payload: RunPluginPayload) {
    const plugin = inject(PluginRegistryService).get(payload.pluginId);
    // An uninstalled plugin's runs are dropped rather than retried.
    if (!plugin?.exports.has('handle_job')) return;
    try {
      await inject(PluginEngineService).job(plugin, {
        key: payload.key,
        guildId: payload.guildId,
        channelId: payload.channelId,
        data: payload.data,
      });
    } catch (error) {
      // A plugin that crashes or times out would do the same on a retry.
      if (!(error instanceof PluginCallError)) throw error;
      logger.warn({ plugin: payload.pluginId, key: payload.key, err: error }, 'Plugin job failed');
    }
  }
}

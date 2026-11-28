import type { Client } from 'discord.js';
import { z } from 'zod';
import { Injectable, inject } from '@/core';
import { PanelRouterService } from '@/modules/panel/panel-router.service';
import { PluginPanelService } from './plugin-panel.service';
import { PluginRegistryService } from './plugin-registry.service';

const toggleSchema = z.object({
  commands: z.array(z.string().min(1)).min(1).max(200),
  enabled: z.boolean(),
});

// Only `enabled` is accepted. The schema is strict so a body carrying `permissions` or
// `allowedHosts` is refused with a 400 instead of being silently dropped.
const pluginSchema = z.object({ enabled: z.boolean() }).strict();

/** Guild from the query string, checked against the servers the bot is actually in. */
function guildOf(query: URLSearchParams, client: Client): string | undefined {
  const wanted = query.get('guild') ?? client.guilds.cache.keys().next().value;
  return wanted && client.guilds.cache.has(wanted) ? wanted : undefined;
}

// One route for the whole segment: core stays unaware of plugin shapes.
@Injectable()
export class PluginPanelRouterService {
  private readonly panel = inject(PluginPanelService);
  private readonly registry = inject(PluginRegistryService);
  private readonly router = inject(PanelRouterService);

  register(): void {
    this.router.route(
      'plugins',
      async ({ segments: [first, second], query, method, body, client }) => {
        const guildId = guildOf(query, client);
        if (query.get('guild') && !guildId)
          return { status: 404, body: { error: 'unknown_guild' } };
        const locale = query.get('locale');
        const action = second ?? undefined;
        if (action === 'refresh' && method === 'POST') {
          return { body: await this.panel.refresh(guildId, locale) };
        }
        if (action === 'deploy' && method === 'POST') {
          // `all` republishes everything; an id only reports how many came from that plugin.
          const result = await this.panel.deploy(first === 'all' ? undefined : first);
          return { body: { ...result, ...(await this.panel.list(guildId, locale)) } };
        }
        if (action === 'commands' && (method === 'PUT' || method === 'POST')) {
          if (!first) return { status: 400, body: { error: 'missing_plugin' } };
          const { commands, enabled } = toggleSchema.parse(body ?? {});
          const own = new Set((this.registry.get(first)?.commands ?? []).map((spec) => spec.name));
          const foreign = commands.filter((name) => !own.has(name));
          if (foreign.length > 0) {
            return { status: 400, body: { error: `not_owned_by: ${first} ${foreign.join(', ')}` } };
          }
          await this.panel.toggle(commands, enabled);
          return { body: await this.panel.list(guildId, locale) };
        }
        if (!second && first && (method === 'PUT' || method === 'PATCH')) {
          await this.panel.update(first, pluginSchema.parse(body ?? {}));
          return { body: await this.panel.list(guildId, locale) };
        }
        if (!second && first && method === 'DELETE') {
          return { status: 405, body: { error: 'plugin_removal_is_a_repository_edit' } };
        }
        if (method === 'GET') {
          return {
            body: {
              ...(await this.panel.list(guildId, locale)),
              registry: await this.registry.definitions(),
            },
          };
        }
        return { status: 405, body: { error: 'method_not_allowed' } };
      },
    );
  }
}

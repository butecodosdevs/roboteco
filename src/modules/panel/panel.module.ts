import { config } from '@/config';
import { inject, Module, type OnGuildRemove, type OnReady, type OnUserErase } from '@/core';
import { ensureScheduled } from '@/core/job';
import { registerPanelGateway } from '@/core/panel-gateway';
import { PruneUsageJob, pruneIntervalMs } from './jobs/prune-usage.job';
import { PanelService } from './panel.service';
import { PanelAuthService } from './panel-auth.service';
import { PanelCatalogService } from './panel-catalog.service';
import { PanelRouterService } from './panel-router.service';
import { PanelSettingsService, registerPanelSettings } from './panel-settings.service';
import { PanelTogglesService } from './panel-toggles.service';
import { PanelUsageService } from './panel-usage.service';

@Module({ jobs: [PruneUsageJob] })
export class PanelModule implements OnReady, OnGuildRemove, OnUserErase {
  private readonly router = inject(PanelRouterService);
  private readonly panel = inject(PanelService);
  private readonly catalog = inject(PanelCatalogService);
  private readonly toggles = inject(PanelTogglesService);
  private readonly usage = inject(PanelUsageService);

  constructor() {
    // Registered at construction instead of on ready: the login screen has to answer while the
    // gateway is still connecting, which is exactly when someone opens the panel to fix a token.
    inject(PanelAuthService).start();
    registerPanelSettings(inject(PanelSettingsService), this.router);

    registerPanelGateway({
      handle: (client, request, response, url, body) =>
        this.panel.handle(request, response, url, {
          client,
          token: config.panelToken,
          method: request.method ?? 'GET',
          body,
        }),
      handleAuth: (request, response) => this.router.forwardAuth(request, response),
      isDisabled: (command) => this.toggles.isDisabled(command),
      recordUsage: (guildId, command, userId, source) =>
        this.usage.record(guildId, command, userId, source),
      describe: (input) => this.catalog.describe(input),
    });
  }

  async onReady() {
    await ensureScheduled(PruneUsageJob, new Date(Date.now() + pruneIntervalMs), {});
  }

  onGuildRemove(guildId: string) {
    return this.usage.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.usage.eraseUser(userId, guildId);
  }
}

import { type Client, GatewayIntentBits, Partials } from 'discord.js';
import {
  delegateComponents,
  inject,
  Module,
  type OnCommandDeploy,
  type OnGuildRemove,
  type OnReady,
  type OnUserErase,
} from '@/core';
import { DomainEventsService } from '@/modules/domain-events/domain-events.service';
import { LevelsModule } from '@/modules/levels/levels.module';
import { ModerationModule } from '@/modules/moderation/moderation.module';
import { PluginCommand } from './commands/plugin/plugin.command';
import { DiscordDataService } from './discord-data.service';
import { GuildMemberAddEvent } from './events/guild-member-add.event';
import { GuildMemberRemoveEvent } from './events/guild-member-remove.event';
import { InteractionCreateEvent } from './events/interaction-create.event';
import { MessageCreateEvent } from './events/message-create.event';
import { MessageReactionAddEvent } from './events/message-reaction-add.event';
import { RunPluginJob } from './jobs/run-plugin.job';
import { PluginActionsService } from './plugin-actions.service';
import { PluginEventsService } from './plugin-events.service';
import { PluginHostService } from './plugin-host.service';
import { PluginJobsService } from './plugin-jobs.service';
import { PluginManifestService } from './plugin-manifest.service';
import { PluginModerationService } from './plugin-moderation.service';
import { registerPluginPanel } from './plugin-panel.service';
import { PluginRegistryService } from './plugin-registry.service';
import { pluginComponentPrefix } from './plugin-render.service';

// Plugin buttons, selects and forms are answered by InteractionCreateEvent, not the core router.
delegateComponents(pluginComponentPrefix);

@Module({
  imports: [LevelsModule, ModerationModule],
  intents: [
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
  commands: [PluginCommand],
  events: [
    InteractionCreateEvent,
    MessageCreateEvent,
    GuildMemberAddEvent,
    GuildMemberRemoveEvent,
    MessageReactionAddEvent,
  ],
  jobs: [RunPluginJob],
})
export class PluginsModule implements OnReady, OnGuildRemove, OnUserErase, OnCommandDeploy {
  private readonly registry = inject(PluginRegistryService);
  private readonly manifests = inject(PluginManifestService);
  private readonly discord = inject(DiscordDataService);
  private readonly events = inject(PluginEventsService);
  private readonly domain = inject(DomainEventsService);
  private readonly host = inject(PluginHostService);
  private readonly jobs = inject(PluginJobsService);
  // Services that only expose capabilities: creating them here registers what they expose.
  readonly capabilities = [inject(PluginActionsService), inject(PluginModerationService)];

  async onReady(client: Client<true>) {
    // Registered before loading, so the panel answers even when every plugin fails.
    registerPluginPanel();
    this.discord.attach(client);
    this.domain.on('levels.levelUp', ({ guildId, userId, level, xp }) =>
      this.events.dispatch('levelUp', guildId, null, { userId, level, xp }),
    );
    this.domain.on('moderation.caseCreated', ({ guildId, ...entry }) =>
      this.events.dispatch('caseCreated', guildId, null, entry),
    );
    await this.registry.loadAll();
  }

  async deployCommands(builtIn: ReadonlySet<string>) {
    await this.registry.loadAll(undefined, (name) => builtIn.has(name));
    const commands = this.registry
      .all()
      .flatMap((plugin) => [
        ...plugin.commands.map((spec) => this.manifests.toCommandJSON(spec)),
        ...plugin.contextMenus.map((spec) => this.manifests.toContextMenuJSON(spec)),
      ]);
    await this.registry.unloadAll();
    return commands;
  }

  async onGuildRemove(guildId: string) {
    await this.host.purgeGuild(guildId);
    await this.jobs.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.host.eraseUser(userId, guildId);
  }
}

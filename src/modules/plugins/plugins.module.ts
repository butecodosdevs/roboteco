import type { Client } from 'discord.js';
import { inject, Module, type OnCommandDeploy, type OnGuildRemove, type OnReady } from '@/core';
import { LevelsModule } from '@/modules/levels/levels.module';
import { ModerationModule } from '@/modules/moderation/moderation.module';
import { PluginCommand } from './commands/plugin/plugin.command';
import { DiscordDataService } from './discord-data.service';
import { InteractionCreateEvent } from './events/interaction-create.event';
import { PluginManifestService } from './plugin-manifest.service';
import { PluginRegistryService } from './plugin-registry.service';

@Module({
  imports: [LevelsModule, ModerationModule],
  commands: [PluginCommand],
  events: [InteractionCreateEvent],
})
export class PluginsModule implements OnReady, OnGuildRemove, OnCommandDeploy {
  private readonly registry = inject(PluginRegistryService);
  private readonly manifests = inject(PluginManifestService);
  private readonly discord = inject(DiscordDataService);

  onReady(client: Client<true>) {
    this.discord.attach(client);
    return this.registry.loadAll();
  }

  async deployCommands(builtIn: ReadonlySet<string>) {
    await this.registry.loadAll(undefined, (name) => builtIn.has(name));
    const commands = this.registry
      .all()
      .flatMap((plugin) => plugin.commands.map((spec) => this.manifests.toCommandJSON(spec)));
    await this.registry.unloadAll();
    return commands;
  }

  onGuildRemove(guildId: string) {
    return this.registry.purgeGuild(guildId);
  }
}

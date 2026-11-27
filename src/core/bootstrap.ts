import { Client, Events, type GatewayIntentBits, type Interaction, MessageFlags } from 'discord.js';
import { closeCache } from '@/cache';
import { closeDb } from '@/db';
import { t } from '@/i18n';
import { flushErrors, logger, reportError } from '@/logger';
import { isDelegatedComponent, kindOf, parseCustomId } from './component';
import { contextMenuKey } from './context-menu';
import { startHttpServer } from './http';
import { JobRunner } from './job';
import { registerCommandCatalog, registerCommandNames, registerModules } from './lifecycle';
import { privilegedIntents, type ResolvedApp, resolveApp } from './module';
import type { Type } from './types';

export interface BootstrapOptions {
  token: string;
  privilegedIntents: boolean;
  healthPort?: number;
  panelToken?: string;
}

function selectIntents(app: ResolvedApp, allowPrivileged: boolean): GatewayIntentBits[] {
  if (allowPrivileged) return app.intents;
  const skipped = app.modules.filter((m) => m.intents.some((i) => privilegedIntents.includes(i)));
  if (skipped.length > 0) {
    logger.warn(
      { modules: skipped.map((m) => m.name) },
      'Privileged intents are disabled, so these modules will miss events. Enable them in the Developer Portal and set DISCORD_PRIVILEGED_INTENTS=true.',
    );
  }
  return app.intents.filter((i) => !privilegedIntents.includes(i));
}

async function route(app: ResolvedApp, interaction: Interaction): Promise<unknown> {
  if (interaction.isChatInputCommand()) {
    return app.commands.get(interaction.commandName)?.handle(interaction);
  }
  if (interaction.isAutocomplete()) {
    return app.commands.get(interaction.commandName)?.autocomplete(interaction);
  }
  if (interaction.isContextMenuCommand()) {
    const key = contextMenuKey(interaction.commandType, interaction.commandName);
    return app.contextMenus.get(key)?.handle(interaction);
  }
  if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
    if (isDelegatedComponent(interaction.customId)) return undefined;
    const { id, args } = parseCustomId(interaction.customId);
    const handler = app.components.get(id);
    if (!handler || handler.kind !== kindOf(interaction) || !interaction.inCachedGuild()) {
      return interaction.reply({
        content: t(interaction.locale, 'errors.componentExpired'),
        flags: MessageFlags.Ephemeral,
      });
    }
    return handler.handle(interaction, args);
  }
  return undefined;
}

export async function bootstrap(root: Type, options: BootstrapOptions): Promise<Client> {
  const app = resolveApp(root);
  registerModules(app.modules);
  registerCommandNames([...app.commands.keys(), ...app.contextMenus.map((m) => m.name)]);
  registerCommandCatalog([
    ...[...app.commands.values()].map((command) => command.toJSON()),
    ...[...app.contextMenus.values()].map((menu) => menu.toJSON()),
  ]);
  const client = new Client({
    intents: selectIntents(app, options.privilegedIntents),
    partials: app.partials,
  });
  const jobs = new JobRunner();
  for (const job of app.jobs) jobs.register(job);

  for (const event of app.events) {
    const listener = async (...args: unknown[]) => {
      try {
        await event.execute(...args);
      } catch (error) {
        reportError(error, { event: event.name }, 'Event handler failed');
      }
    };
    if (event.once) client.once(event.name, listener);
    else client.on(event.name, listener);
  }

  client.once(Events.ClientReady, async (ready) => {
    for (const { name, instance } of app.modules) {
      try {
        await instance.onReady?.(ready);
      } catch (error) {
        reportError(error, { module: name }, 'onReady failed');
      }
    }
    jobs.start(ready);
    logger.info(
      { user: ready.user.tag, modules: app.modules.length, guilds: ready.guilds.cache.size },
      'Logged in',
    );
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await route(app, interaction);
    } catch (error) {
      reportError(
        error,
        {
          interaction: interaction.id,
          type: interaction.type,
          guild: interaction.guildId,
          user: interaction.user.id,
        },
        'Interaction failed',
      );
      if (!interaction.isRepliable()) return;
      const reply = {
        content: t(interaction.locale, 'errors.commandFailed'),
        flags: MessageFlags.Ephemeral,
      } as const;
      if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
      else await interaction.reply(reply);
    }
  });

  const health = options.healthPort
    ? startHttpServer(client, options.healthPort, { panelToken: options.panelToken })
    : undefined;

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    jobs.stop();
    health?.close();
    await client.destroy();
    await closeDb();
    await closeCache();
    await flushErrors();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('unhandledRejection', (reason) => {
    reportError(reason, {}, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', async (error) => {
    reportError(error, {}, 'Uncaught exception');
    await flushErrors();
    process.exit(1);
  });
  client.on(Events.Error, (error) => reportError(error, {}, 'Discord client error'));
  client.on(Events.Warn, (message) => logger.warn(message));
  client.on(Events.ShardDisconnect, (_event, shard) =>
    logger.warn({ shard }, 'Gateway disconnected'),
  );
  client.on(Events.ShardResume, (shard) => logger.info({ shard }, 'Gateway resumed'));

  await client.login(options.token);
  return client;
}

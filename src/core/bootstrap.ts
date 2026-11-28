import {
  Client,
  Events,
  type GatewayIntentBits,
  type Interaction,
  MessageFlags,
  type RepliableInteraction,
} from 'discord.js';
import { closeCache } from '@/cache';
import { closeDb } from '@/db';
import { t } from '@/i18n';
import { flushErrors, logger, reportError } from '@/logger';
import { isDelegatedComponent, kindOf, parseCustomId } from './component';
import { contextMenuKey } from './context-menu';
import { startHttpServer } from './http';
import { JobRunner } from './job';
import { registerCommandNames, registerModules } from './lifecycle';
import { privilegedIntents, type ResolvedApp, resolveApp } from './module';
import { panelGateway } from './panel-gateway';
import type { Type } from './types';

export interface BootstrapOptions {
  token: string;
  privilegedIntents: boolean;
  healthPort?: number;
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

/**
 * The member asked for a command the panel turned off. Saying so beats leaving the interaction
 * unacknowledged, which shows up as "The application did not respond" to whoever ran it.
 */
function disabledReply(interaction: RepliableInteraction): Promise<unknown> {
  return interaction.reply({
    content: t(interaction.locale, 'errors.commandDisabled'),
    flags: MessageFlags.Ephemeral,
  });
}

async function route(app: ResolvedApp, interaction: Interaction): Promise<unknown> {
  const panel = panelGateway();
  if (interaction.isChatInputCommand()) {
    /**
     * A disabled command answers instead of vanishing: returning `undefined` here left the
     * interaction unacknowledged, and Discord tells the member "The application did not respond"
     * three seconds later. The toggle is per bot, not per server, so the text says so.
     */
    if (panel?.isDisabled(interaction.commandName)) return disabledReply(interaction);
    const handler = app.commands.get(interaction.commandName);
    if (handler && interaction.inGuild()) {
      panel?.recordUsage(interaction.guildId, handler.name, interaction.user.id, 'builtin');
    }
    return handler?.handle(interaction);
  }
  if (interaction.isAutocomplete()) {
    if (panel?.isDisabled(interaction.commandName)) return interaction.respond([]);
    return app.commands.get(interaction.commandName)?.autocomplete(interaction);
  }
  if (interaction.isContextMenuCommand()) {
    if (panel?.isDisabled(interaction.commandName)) return disabledReply(interaction);
    const key = contextMenuKey(interaction.commandType, interaction.commandName);
    const handler = app.contextMenus.get(key);
    if (handler && interaction.inGuild()) {
      panel?.recordUsage(interaction.guildId, handler.name, interaction.user.id, 'builtin');
    }
    return handler?.handle(interaction);
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
  // Handed straight to the panel, which is the only reader: keeping a copy here would be the
  // module-level state the structure rules forbid.
  panelGateway()?.describe({
    catalog: [
      ...[...app.commands.values()].map((command) => command.toJSON()),
      ...[...app.contextMenus.values()].map((menu) => menu.toJSON()),
    ],
    builtIn: [...app.commands.keys(), ...app.contextMenus.map((menu) => menu.name)],
    owners: Object.fromEntries(
      app.modules.flatMap((module) => module.commands.map((name) => [name, module.name])),
    ),
  });
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

  const health = options.healthPort ? startHttpServer(client, options.healthPort) : undefined;

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

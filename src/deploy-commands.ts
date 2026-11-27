import {
  type APIApplicationCommand,
  REST,
  type RESTPostAPIApplicationCommandsJSONBody,
  Routes,
} from 'discord.js';
import { and, eq } from 'drizzle-orm';
import { resolveApp } from '@/core';
import { closeDb, db, schema } from '@/db';
import { AppModule } from './app.module';
import { config } from './config';
import { logger } from './logger';

const rest = new REST().setToken(config.token);
const app = resolveApp(AppModule);
const builtIn = new Set(app.commands.keys());
const body: RESTPostAPIApplicationCommandsJSONBody[] = [
  ...app.commands.map((c) => c.toJSON()),
  ...app.contextMenus.map((m) => m.toJSON()),
];
for (const { instance } of app.modules) {
  body.push(...((await instance.deployCommands?.(builtIn)) ?? []));
}

const route = config.guildId
  ? Routes.applicationGuildCommands(config.clientId, config.guildId)
  : Routes.applicationCommands(config.clientId);

// Guild-scoped deploys replace every guild command, so custom commands must be sent along.
const custom = config.guildId
  ? await db
      .select()
      .from(schema.customCommands)
      .where(eq(schema.customCommands.guildId, config.guildId))
  : [];
const registered = (await rest.put(route, {
  body: [...body, ...custom.map(({ name, description }) => ({ name, description }))],
})) as APIApplicationCommand[];
for (const command of registered) {
  const match = custom.find((c) => c.name === command.name);
  if (match && config.guildId) {
    await db
      .update(schema.customCommands)
      .set({ commandId: command.id })
      .where(
        and(
          eq(schema.customCommands.guildId, config.guildId),
          eq(schema.customCommands.name, match.name),
        ),
      );
  }
}
await closeDb();
logger.info({ commands: body.length, guild: config.guildId ?? 'global' }, 'Registered commands');

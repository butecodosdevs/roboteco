import { REST, Routes } from 'discord.js';
import { and, eq } from 'drizzle-orm';
import { config } from '@/config';
import { Injectable, type RegisteredCommand } from '@/core';
import { db, schema } from '@/db';

export interface DeployResult {
  commands: number;
  guild: string;
}

@Injectable()
export class PluginDeployService {
  private readonly rest = new REST().setToken(config.token);

  /**
   * Guild-scoped deploys replace every guild command, so custom commands are always sent along;
   * otherwise a panel deploy would silently delete them.
   */
  async deploy(body: RegisteredCommand[]): Promise<DeployResult> {
    const custom = config.guildId
      ? await db
          .select()
          .from(schema.customCommands)
          .where(eq(schema.customCommands.guildId, config.guildId))
      : [];
    const route = config.guildId
      ? Routes.applicationGuildCommands(config.clientId, config.guildId)
      : Routes.applicationCommands(config.clientId);
    const registered = (await this.rest.put(route, {
      body: [...body, ...custom.map(({ name, description }) => ({ name, description }))],
    })) as { id: string; name: string }[];

    if (config.guildId) {
      for (const command of registered) {
        const match = custom.find((c) => c.name === command.name);
        if (!match) continue;
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
    return { commands: body.length, guild: config.guildId ?? 'global' };
  }
}

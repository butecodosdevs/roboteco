import type {
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';

export type RegisteredCommand =
  | RESTPostAPIChatInputApplicationCommandsJSONBody
  | RESTPostAPIContextMenuApplicationCommandsJSONBody;

import type { ResolvedModule } from './module';

let registered: ResolvedModule[] = [];
let commandNames = new Set<string>();
let catalog: RegisteredCommand[] = [];

export function registerModules(modules: ResolvedModule[]): void {
  registered = modules;
}

export async function purgeGuildData(guildId: string): Promise<void> {
  for (const { instance } of registered) await instance.onGuildRemove?.(guildId);
}

export async function eraseUserData(userId: string, guildId?: string): Promise<void> {
  for (const { instance } of registered) await instance.onUserErase?.(userId, guildId);
}

export function registerCommandNames(names: Iterable<string>): void {
  commandNames = new Set(names);
}

/** Everything a slash command needs to be re-registered, including plugin commands. */
export function registerCommandCatalog(entries: RegisteredCommand[]) {
  catalog = entries;
}

export function commandCatalog(): RegisteredCommand[] {
  return catalog;
}

export function isBuiltInCommand(name: string): boolean {
  return commandNames.has(name);
}

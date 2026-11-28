import type { ResolvedModule } from './module';

let registered: ResolvedModule[] = [];
let commandNames = new Set<string>();

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

export function isBuiltInCommand(name: string): boolean {
  return commandNames.has(name);
}

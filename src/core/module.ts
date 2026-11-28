import {
  type Client,
  Collection,
  GatewayIntentBits,
  type Partials,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import { CommandHandler } from './command';
import { ComponentHandler } from './component';
import { ContextMenuHandler } from './context-menu';
import { EventHandler } from './event';
import type { Type } from './types';

export interface ModuleOptions {
  imports?: Type[];
  intents?: GatewayIntentBits[];
  partials?: Partials[];
  commands?: Type[];
  contextMenus?: Type[];
  components?: Type[];
  events?: Type[];
  jobs?: Type[];
}

export interface OnReady {
  onReady(client: Client<true>): Promise<void> | void;
}

export interface OnCommandDeploy {
  /** Slash commands this module registers at deploy time on top of its decorated ones. */
  deployCommands(builtIn: ReadonlySet<string>): Promise<RESTPostAPIApplicationCommandsJSONBody[]>;
}

export interface OnGuildRemove {
  onGuildRemove(guildId: string): Promise<void>;
}

export interface OnUserErase {
  onUserErase(userId: string, guildId?: string): Promise<void>;
}

const moduleMeta = new WeakMap<Type, ModuleOptions>();

export function Module(options: ModuleOptions = {}) {
  return (target: Type, _context: ClassDecoratorContext) => {
    moduleMeta.set(target, options);
  };
}

export const privilegedIntents = [
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildPresences,
  GatewayIntentBits.MessageContent,
];

export interface ResolvedModule {
  name: string;
  intents: GatewayIntentBits[];
  instance: Partial<OnReady & OnGuildRemove & OnUserErase & OnCommandDeploy>;
  /** Slash command names this module decorated, so the panel can group them by owner. */
  commands: string[];
}

export interface ResolvedApp {
  intents: GatewayIntentBits[];
  partials: Partials[];
  commands: Collection<string, CommandHandler>;
  contextMenus: Collection<string, ContextMenuHandler>;
  components: Collection<string, ComponentHandler>;
  events: EventHandler[];
  jobs: Type[];
  modules: ResolvedModule[];
}

function add<T>(map: Collection<string, T>, key: string, value: T, what: string, owner: string) {
  if (map.has(key)) throw new Error(`Duplicate ${what} "${key}" in ${owner}`);
  map.set(key, value);
}

export function resolveApp(root: Type): ResolvedApp {
  const app: ResolvedApp = {
    intents: [GatewayIntentBits.Guilds],
    partials: [],
    commands: new Collection(),
    contextMenus: new Collection(),
    components: new Collection(),
    events: [],
    jobs: [],
    modules: [],
  };
  const visited = new Set<Type>();

  const visit = (target: Type) => {
    if (visited.has(target)) return;
    visited.add(target);
    const options = moduleMeta.get(target);
    if (!options) throw new Error(`${target.name} is not decorated with @Module()`);
    options.imports?.forEach(visit);
    const names: string[] = [];

    for (const command of options.commands ?? []) {
      const handler = new CommandHandler(command);
      add(app.commands, handler.name, handler, 'command', target.name);
      names.push(handler.name);
    }
    for (const menu of options.contextMenus ?? []) {
      const handler = new ContextMenuHandler(menu);
      add(app.contextMenus, handler.key, handler, 'context menu', target.name);
      names.push(menu.name);
    }
    for (const component of options.components ?? []) {
      const handler = new ComponentHandler(component);
      add(app.components, handler.id, handler, 'component', target.name);
    }
    for (const event of options.events ?? []) app.events.push(new EventHandler(event));
    app.jobs.push(...(options.jobs ?? []));
    app.intents.push(...(options.intents ?? []));
    app.partials.push(...(options.partials ?? []));
    app.modules.push({
      name: target.name,
      intents: options.intents ?? [],
      instance: new target(),
      commands: names,
    });
  };

  visit(root);
  app.intents = [...new Set(app.intents)];
  app.partials = [...new Set(app.partials)];
  return app;
}

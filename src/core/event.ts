import type { ClientEvents } from 'discord.js';
import type { Type } from './types';

interface EventMeta {
  name: keyof ClientEvents;
  once: boolean;
}

const eventMeta = new WeakMap<Type, EventMeta>();

type Listener<K extends keyof ClientEvents> = { execute: (...args: ClientEvents[K]) => unknown };

function listen<K extends keyof ClientEvents>(name: K, once: boolean) {
  return (target: Type<Listener<K>>, _context: ClassDecoratorContext) => {
    eventMeta.set(target, { name, once });
  };
}

export const On = <K extends keyof ClientEvents>(name: K) => listen(name, false);
export const Once = <K extends keyof ClientEvents>(name: K) => listen(name, true);

export class EventHandler {
  readonly name: keyof ClientEvents;
  readonly once: boolean;
  private readonly instance: { execute: (...args: unknown[]) => unknown };

  constructor(target: Type) {
    const meta = eventMeta.get(target);
    if (!meta) throw new Error(`${target.name} is not decorated with @On() or @Once()`);
    this.name = meta.name;
    this.once = meta.once;
    this.instance = new target() as typeof this.instance;
  }

  execute(...args: unknown[]): unknown {
    return this.instance.execute(...args);
  }
}

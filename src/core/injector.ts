import { claimCapabilities } from './expose';
import type { Type } from './types';

const injectables = new WeakSet<Type>();
const instances = new Map<Type, unknown>();

export function Injectable() {
  return (target: Type, _context: ClassDecoratorContext) => {
    injectables.add(target);
    claimCapabilities(target);
  };
}

export function inject<T extends object>(token: Type<T>): T {
  if (instances.has(token)) return instances.get(token) as T;
  if (!injectables.has(token)) throw new Error(`${token.name} is not decorated with @Injectable()`);
  const instance = new token();
  instances.set(token, instance);
  return instance;
}

export function provide<T extends object>(token: Type<T>, instance: T): void {
  instances.set(token, instance);
}

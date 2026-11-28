import { Injectable } from '@/core';
import { reportError } from '@/logger';

export interface DomainEvents {
  'levels.levelUp': { guildId: string; userId: string; level: number; xp: number };
  'moderation.caseCreated': {
    guildId: string;
    number: number;
    action: string;
    targetId: string;
    moderatorId: string;
    reason: string | null;
    durationSeconds: number | null;
  };
}

export type DomainEventName = keyof DomainEvents;
type Listener<K extends DomainEventName> = (payload: DomainEvents[K]) => Promise<unknown> | unknown;

/**
 * An in-process event bus. Features emit after their own work is done, and listeners run in the
 * background, so a slow or failing listener never delays or breaks the feature that emitted.
 */
@Injectable()
export class DomainEventsService {
  private readonly listeners = new Map<DomainEventName, Set<Listener<never>>>();

  on<K extends DomainEventName>(name: K, listener: Listener<K>): () => void {
    const set = this.listeners.get(name) ?? new Set();
    set.add(listener as Listener<never>);
    this.listeners.set(name, set);
    return () => set.delete(listener as Listener<never>);
  }

  emit<K extends DomainEventName>(name: K, payload: DomainEvents[K]): void {
    for (const listener of this.listeners.get(name) ?? []) {
      Promise.resolve()
        .then(() => (listener as Listener<K>)(payload))
        .catch((error) => reportError(error, { event: name }, 'Domain event listener failed'));
    }
  }
}

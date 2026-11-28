import type {
  ButtonInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import type { Type } from './types';

export type GuildButtonInteraction = ButtonInteraction<'cached'>;
export type GuildSelectInteraction = StringSelectMenuInteraction<'cached'>;
export type GuildModalInteraction = ModalSubmitInteraction<'cached'>;

export type ComponentKind = 'button' | 'select' | 'modal';

type ComponentTarget<I> = Type<{ execute: (interaction: I, args: string[]) => Promise<unknown> }>;

const componentMeta = new WeakMap<Type, { id: string; kind: ComponentKind }>();
const separator = ':';

function component<I>(kind: ComponentKind) {
  return (id: string) => (target: ComponentTarget<I>, _context: ClassDecoratorContext) => {
    if (id.includes(separator))
      throw new Error(`Component id "${id}" must not contain "${separator}"`);
    componentMeta.set(target, { id, kind });
  };
}

export const Button = component<GuildButtonInteraction>('button');
export const SelectMenu = component<GuildSelectInteraction>('select');
export const Modal = component<GuildModalInteraction>('modal');

export function customId(target: Type, ...args: (string | number)[]): string {
  const meta = componentMeta.get(target);
  if (!meta)
    throw new Error(`${target.name} is not decorated with @Button(), @SelectMenu() or @Modal()`);
  const id = [meta.id, ...args].join(separator);
  if (id.length > 100) throw new Error(`customId "${id}" is longer than 100 characters`);
  return id;
}

const delegated = new Set<string>();

/**
 * Lets a module answer, through its own event listener, components whose custom id starts with
 * `prefix:`. The router then leaves them alone instead of calling them expired.
 */
export function delegateComponents(prefix: string): void {
  delegated.add(prefix);
}

export function isDelegatedComponent(customId: string): boolean {
  return delegated.has(customId.slice(0, customId.indexOf(':')));
}

export function parseCustomId(value: string): { id: string; args: string[] } {
  const [id = '', ...args] = value.split(separator);
  return { id, args };
}

export function kindOf(
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
): ComponentKind | undefined {
  if (interaction.isButton()) return 'button';
  if (interaction.isStringSelectMenu()) return 'select';
  if (interaction.isModalSubmit()) return 'modal';
  return undefined;
}

export class ComponentHandler {
  readonly id: string;
  readonly kind: ComponentKind;
  private readonly instance: {
    execute: (interaction: unknown, args: string[]) => Promise<unknown>;
  };

  constructor(target: Type) {
    const meta = componentMeta.get(target);
    if (!meta)
      throw new Error(`${target.name} is not decorated with @Button(), @SelectMenu() or @Modal()`);
    this.id = meta.id;
    this.kind = meta.kind;
    this.instance = new target() as typeof this.instance;
  }

  handle(interaction: unknown, args: string[]): Promise<unknown> {
    return this.instance.execute(interaction, args);
  }
}

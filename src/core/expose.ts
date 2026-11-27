import { z } from 'zod';
import type { Type } from './types';

export const snowflake = z.string().regex(/^\d{15,21}$/, 'must be a Discord ID');

/** Who is asking: always set by the bot from the interaction, never by the plugin. */
export interface PluginScope {
  pluginId: string;
  guildId: string;
  userId: string;
  channelId: string;
}

export interface ExposeOptions<I extends z.ZodType, O extends z.ZodType> {
  /** Omit for harmless capabilities (logging) that every plugin may call without declaring them. */
  permission?: string;
  description: string;
  input: I;
  output: O;
}

export interface Capability {
  name: string;
  permission?: string;
  description: string;
  input: z.ZodType;
  output: z.ZodType;
  target?: Type;
  method: (this: object, scope: PluginScope, input: unknown) => unknown;
}

export class CapabilityInputError extends Error {}

/** Throw from an exposed method to give the plugin a specific, safe error code and message. */
export class CapabilityError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const capabilities = new Map<string, Capability>();
const pending: Capability[] = [];

/**
 * Makes a service method callable by plugins under `name`. The method keeps working as normal
 * code; plugins reach it through the plugin host, which checks `permission`, validates the
 * input, and strips the result down to `output`.
 */
export function Expose<I extends z.ZodType, O extends z.ZodType>(
  name: string,
  options: ExposeOptions<I, O>,
) {
  return (
    method: (scope: PluginScope, input: z.output<I>) => Promise<z.input<O>> | z.input<O>,
    _context: ClassMethodDecoratorContext,
  ) => {
    if (capabilities.has(name) || pending.some((c) => c.name === name)) {
      throw new Error(`Capability "${name}" is exposed twice`);
    }
    pending.push({ name, ...options, method: method as Capability['method'] });
  };
}

// Method decorators run before their class decorator, so @Injectable claims what it just saw.
export function claimCapabilities(target: Type): void {
  for (const capability of pending.splice(0)) {
    capabilities.set(capability.name, { ...capability, target });
  }
}

export function capability(name: string): Capability | undefined {
  return capabilities.get(name);
}

export function allCapabilities(): Capability[] {
  return [...capabilities.values()];
}

export async function invokeCapability(
  cap: Capability,
  scope: PluginScope,
  input: unknown,
  resolve: (target: Type) => object,
): Promise<unknown> {
  if (!cap.target) throw new Error(`Capability "${cap.name}" is not on an @Injectable() class`);
  const parsed = cap.input.safeParse(input ?? {});
  if (!parsed.success) throw new CapabilityInputError(z.prettifyError(parsed.error));
  const result = await cap.method.call(resolve(cap.target), scope, parsed.data);
  return cap.output.parse(result);
}

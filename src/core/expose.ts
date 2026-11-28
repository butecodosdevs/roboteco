import { PermissionsBitField } from 'discord.js';
import { z } from 'zod';
import type { Type } from './types';

export const snowflake = z.string().regex(/^\d{15,21}$/, 'must be a Discord ID');

export interface PluginCaller {
  userId: string;
  /** Their permissions in the channel, as Discord computed them for the interaction. */
  permissions: bigint;
}

/** Where a plugin call comes from: always set by the bot, never by the plugin. */
export interface PluginScope {
  pluginId: string;
  guildId: string;
  channelId: string | null;
  /**
   * Null for events and scheduled runs: nobody is asking, so the plugin acts with what the
   * server granted it.
   */
  caller: PluginCaller | null;
}

export function callerMay(scope: PluginScope, flag: bigint): boolean {
  return !scope.caller || new PermissionsBitField(scope.caller.permissions).has(flag);
}

export interface ExposeOptions<I extends z.ZodType, O extends z.ZodType> {
  /** Omit for harmless capabilities (logging) that every plugin may call without declaring them. */
  permission?: string;
  /**
   * A Discord permission the calling member must have, so a plugin can't do for a member what
   * the member couldn't do themselves. Events and scheduled runs have no caller and skip it.
   */
  caller?: bigint;
  description: string;
  input: I;
  output: O;
}

export interface Capability {
  name: string;
  permission?: string;
  caller?: bigint;
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
  if (cap.caller !== undefined && !callerMay(scope, cap.caller)) {
    const names = new PermissionsBitField(cap.caller).toArray().join(', ');
    throw new CapabilityError('caller_forbidden', `the member who ran this needs ${names}`);
  }
  const parsed = cap.input.safeParse(input ?? {});
  if (!parsed.success) throw new CapabilityInputError(z.prettifyError(parsed.error));
  const result = await cap.method.call(resolve(cap.target), scope, parsed.data);
  return cap.output.parse(result);
}

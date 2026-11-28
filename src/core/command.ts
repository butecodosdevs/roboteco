import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
  type SlashCommandSubcommandBuilder,
  type SlashCommandSubcommandGroupBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { t } from '@/i18n';
import { Cooldowns, replyCooldown } from './cooldown';
import { lacksDefaultPermissions, refuseMissing } from './permissions';
import type { Type } from './types';

export type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export type GuildInteraction = ChatInputCommandInteraction<'cached'>;
export type GuildAutocompleteInteraction = AutocompleteInteraction<'cached'>;

type Executable<I> = { execute: (interaction: I) => Promise<unknown> };
type Autocompletable = { autocomplete: (interaction: AutocompleteInteraction) => Promise<unknown> };
type Handler = Executable<ChatInputCommandInteraction> & Partial<Autocompletable>;

interface CommandOptions {
  data: CommandData;
  guildOnly?: boolean;
  subcommands?: readonly Type[];
  /** `@SubcommandGroup` classes: `/command group subcommand`. */
  groups?: readonly Type[];
  cooldown?: number;
}

interface CommandMeta {
  data: CommandData;
  guildOnly: boolean;
  subcommands: readonly Type[];
  groups: readonly Type[];
  cooldown: number;
}

interface GroupMeta {
  data: SlashCommandSubcommandGroupBuilder;
  subcommands: readonly Type[];
}

interface SubcommandMeta {
  data: SlashCommandSubcommandBuilder;
  cooldown: number;
}

const commandMeta = new WeakMap<Type, CommandMeta>();
const subcommandMeta = new WeakMap<Type, SubcommandMeta>();
const groupMeta = new WeakMap<Type, GroupMeta>();
// Discord's limits: 25 subcommands and groups per command, 25 subcommands per group.
const maxOptions = 25;

type ClassDecorator<T> = (target: T, context: ClassDecoratorContext) => void;

/** A parent of subcommands, groups or both; it has no `execute` of its own. */
type Parent<I> =
  | { subcommands: readonly Type<Executable<I>>[]; groups?: readonly Type[] }
  | { subcommands?: readonly Type<Executable<I>>[]; groups: readonly Type[] };

export function Command(
  options: CommandOptions & { guildOnly: true } & Parent<GuildInteraction>,
): ClassDecorator<Type>;
export function Command(
  options: CommandOptions & { guildOnly?: false } & Parent<ChatInputCommandInteraction>,
): ClassDecorator<Type>;
export function Command(
  options: CommandOptions & { guildOnly: true },
): ClassDecorator<Type<Executable<GuildInteraction>>>;
export function Command(
  options: CommandOptions & { guildOnly?: false },
): ClassDecorator<Type<Executable<ChatInputCommandInteraction>>>;
export function Command(options: CommandOptions): ClassDecorator<Type> {
  return (target) => {
    commandMeta.set(target, {
      data: options.data,
      guildOnly: options.guildOnly ?? false,
      subcommands: options.subcommands ?? [],
      groups: options.groups ?? [],
      cooldown: options.cooldown ?? 0,
    });
  };
}

export function Subcommand(
  data: SlashCommandSubcommandBuilder,
  options: { cooldown?: number } = {},
) {
  return (target: Type<Executable<never>>, _context: ClassDecoratorContext) => {
    subcommandMeta.set(target, { data, cooldown: options.cooldown ?? 0 });
  };
}

/** A group of subcommands, used as `/command group subcommand`. List it in `@Command({ groups })`. */
export function SubcommandGroup(
  data: SlashCommandSubcommandGroupBuilder,
  options: { subcommands: readonly Type<Executable<never>>[] },
) {
  return (target: Type, _context: ClassDecoratorContext) => {
    groupMeta.set(target, { data, subcommands: options.subcommands });
  };
}

function subcommandOf(sub: Type): SubcommandMeta {
  const meta = subcommandMeta.get(sub);
  if (!meta) throw new Error(`${sub.name} is not decorated with @Subcommand()`);
  return meta;
}

function groupOf(group: Type): GroupMeta {
  const meta = groupMeta.get(group);
  if (!meta) throw new Error(`${group.name} is not decorated with @SubcommandGroup()`);
  return meta;
}

/** How a subcommand is found: its name, or `group name` inside a group. */
const routeKey = (group: string | null, subcommand: string | null) =>
  group ? `${group} ${subcommand}` : subcommand;

export class CommandHandler {
  readonly name: string;
  private readonly meta: CommandMeta;
  private readonly instance: Partial<Handler>;
  private readonly subcommands = new Map<string, { handler: Handler; cooldown: number }>();
  private readonly cooldowns = new Cooldowns();

  constructor(target: Type) {
    const meta = commandMeta.get(target);
    if (!meta) throw new Error(`${target.name} is not decorated with @Command()`);
    this.meta = meta;
    this.name = meta.data.name;
    this.instance = new target();
    if (meta.subcommands.length + meta.groups.length > maxOptions) {
      throw new Error(`/${this.name} has more than ${maxOptions} subcommands and groups`);
    }
    for (const sub of meta.subcommands) this.register(null, sub);
    for (const group of meta.groups) {
      const { data, subcommands } = groupOf(group);
      if (subcommands.length > maxOptions) {
        throw new Error(`/${this.name} ${data.name} has more than ${maxOptions} subcommands`);
      }
      for (const sub of subcommands) this.register(data.name, sub);
    }
  }

  private register(group: string | null, sub: Type) {
    const meta = subcommandOf(sub);
    const key = routeKey(group, meta.data.name) as string;
    if (this.subcommands.has(key)) throw new Error(`/${this.name} ${key} is declared twice`);
    this.subcommands.set(key, { handler: new sub() as Handler, cooldown: meta.cooldown });
  }

  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody {
    const json = this.meta.data.toJSON();
    const subcommands = this.meta.subcommands.map((sub) => subcommandOf(sub).data.toJSON());
    const groups = this.meta.groups.map((group) => {
      const { data, subcommands } = groupOf(group);
      return {
        ...data.toJSON(),
        options: subcommands.map((sub) => subcommandOf(sub).data.toJSON()),
      };
    });
    return {
      ...json,
      options: [...(json.options ?? []), ...subcommands, ...groups],
      ...(this.meta.guildOnly && { contexts: [InteractionContextType.Guild] }),
    };
  }

  handle(interaction: ChatInputCommandInteraction): Promise<unknown> {
    if (this.meta.guildOnly && !interaction.inCachedGuild()) {
      return interaction.reply({
        content: t(interaction.locale, 'errors.guildOnly'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const missing = this.missingPermissions(interaction);
    if (missing !== null) return refuseMissing(interaction, missing);
    const key = this.keyOf(interaction);
    const handler = this.handlerFor(key);
    if (!handler?.execute) throw new Error(`No handler for /${[this.name, key].join(' ').trim()}`);
    const cooldown = key ? (this.subcommands.get(key)?.cooldown ?? 0) : this.meta.cooldown;
    const wait = this.cooldowns.remaining(`${interaction.user.id}:${key ?? ''}`, cooldown);
    if (wait > 0) return replyCooldown(interaction, wait);
    return handler.execute(interaction);
  }

  autocomplete(interaction: AutocompleteInteraction): Promise<unknown> {
    if (this.meta.guildOnly && !interaction.inCachedGuild()) return interaction.respond([]);
    if (this.missingPermissions(interaction) !== null) return interaction.respond([]);
    const handler = this.handlerFor(this.keyOf(interaction));
    if (!handler?.autocomplete) return interaction.respond([]);
    return handler.autocomplete(interaction);
  }

  private missingPermissions(
    interaction: ChatInputCommandInteraction | AutocompleteInteraction,
  ): bigint | null {
    return lacksDefaultPermissions(
      this.meta.data.default_member_permissions,
      interaction.memberPermissions,
    );
  }

  private keyOf(interaction: ChatInputCommandInteraction | AutocompleteInteraction) {
    return routeKey(
      interaction.options.getSubcommandGroup(false),
      interaction.options.getSubcommand(false),
    );
  }

  private handlerFor(key: string | null): Partial<Handler> | undefined {
    return key ? this.subcommands.get(key)?.handler : this.instance;
  }
}

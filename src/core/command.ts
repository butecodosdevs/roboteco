import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
  type SlashCommandSubcommandBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { t } from '@/i18n';
import { Cooldowns, replyCooldown } from './cooldown';
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
  cooldown?: number;
}

interface CommandMeta {
  data: CommandData;
  guildOnly: boolean;
  subcommands: readonly Type[];
  cooldown: number;
}

interface SubcommandMeta {
  data: SlashCommandSubcommandBuilder;
  cooldown: number;
}

const commandMeta = new WeakMap<Type, CommandMeta>();
const subcommandMeta = new WeakMap<Type, SubcommandMeta>();

type ClassDecorator<T> = (target: T, context: ClassDecoratorContext) => void;

export function Command(
  options: CommandOptions & {
    guildOnly: true;
    subcommands: readonly Type<Executable<GuildInteraction>>[];
  },
): ClassDecorator<Type>;
export function Command(
  options: CommandOptions & {
    guildOnly?: false;
    subcommands: readonly Type<Executable<ChatInputCommandInteraction>>[];
  },
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
    for (const sub of meta.subcommands) {
      const meta = subcommandMeta.get(sub);
      if (!meta) throw new Error(`${sub.name} is not decorated with @Subcommand()`);
      this.subcommands.set(meta.data.name, {
        handler: new sub() as Handler,
        cooldown: meta.cooldown,
      });
    }
  }

  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody {
    const json = this.meta.data.toJSON();
    const subcommands = this.meta.subcommands.map((sub) => subcommandMeta.get(sub)?.data.toJSON());
    return {
      ...json,
      options: [...(json.options ?? []), ...subcommands.filter((s) => s !== undefined)],
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
    const subcommand = interaction.options.getSubcommand(false);
    const handler = this.handlerFor(subcommand);
    if (!handler?.execute) throw new Error(`No handler for /${this.name}`);
    const cooldown = subcommand
      ? (this.subcommands.get(subcommand)?.cooldown ?? 0)
      : this.meta.cooldown;
    const wait = this.cooldowns.remaining(`${interaction.user.id}:${subcommand ?? ''}`, cooldown);
    if (wait > 0) return replyCooldown(interaction, wait);
    return handler.execute(interaction);
  }

  autocomplete(interaction: AutocompleteInteraction): Promise<unknown> {
    if (this.meta.guildOnly && !interaction.inCachedGuild()) return interaction.respond([]);
    const handler = this.handlerFor(interaction.options.getSubcommand(false));
    if (!handler?.autocomplete) return interaction.respond([]);
    return handler.autocomplete(interaction);
  }

  private handlerFor(subcommand: string | null): Partial<Handler> | undefined {
    return subcommand ? this.subcommands.get(subcommand)?.handler : this.instance;
  }
}

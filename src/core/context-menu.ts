import {
  ApplicationCommandType,
  type ContextMenuCommandBuilder,
  type ContextMenuCommandInteraction,
  InteractionContextType,
  type MessageContextMenuCommandInteraction,
  MessageFlags,
  type RESTPostAPIContextMenuApplicationCommandsJSONBody,
  type UserContextMenuCommandInteraction,
} from 'discord.js';
import { t } from '@/i18n';
import { Cooldowns, replyCooldown } from './cooldown';
import { lacksDefaultPermissions, refuseMissing } from './permissions';
import type { Type } from './types';

export type GuildUserContextInteraction = UserContextMenuCommandInteraction<'cached'>;
export type GuildMessageContextInteraction = MessageContextMenuCommandInteraction<'cached'>;

type MenuType = ApplicationCommandType.User | ApplicationCommandType.Message;

const menuMeta = new WeakMap<
  Type,
  { data: ContextMenuCommandBuilder; type: MenuType; cooldown: number }
>();

function contextMenu<I>(type: MenuType) {
  return (data: ContextMenuCommandBuilder, options: { cooldown?: number } = {}) =>
    (
      target: Type<{ execute: (interaction: I) => Promise<unknown> }>,
      _context: ClassDecoratorContext,
    ) => {
      menuMeta.set(target, { data: data.setType(type), type, cooldown: options.cooldown ?? 0 });
    };
}

export const UserContextMenu = contextMenu<GuildUserContextInteraction>(
  ApplicationCommandType.User,
);
export const MessageContextMenu = contextMenu<GuildMessageContextInteraction>(
  ApplicationCommandType.Message,
);

export const contextMenuKey = (type: ApplicationCommandType, name: string) => `${type}:${name}`;

export class ContextMenuHandler {
  readonly key: string;
  readonly name: string;
  private readonly data: ContextMenuCommandBuilder;
  private readonly cooldown: number;
  private readonly cooldowns = new Cooldowns();
  private readonly instance: {
    execute: (interaction: ContextMenuCommandInteraction) => Promise<unknown>;
  };

  constructor(target: Type) {
    const meta = menuMeta.get(target);
    if (!meta) {
      throw new Error(
        `${target.name} is not decorated with @UserContextMenu() or @MessageContextMenu()`,
      );
    }
    this.data = meta.data;
    this.cooldown = meta.cooldown;
    this.name = meta.data.name;
    this.key = contextMenuKey(meta.type, meta.data.name);
    this.instance = new target() as typeof this.instance;
  }

  toJSON(): RESTPostAPIContextMenuApplicationCommandsJSONBody {
    return { ...this.data.toJSON(), contexts: [InteractionContextType.Guild] };
  }

  handle(interaction: ContextMenuCommandInteraction): Promise<unknown> {
    if (!interaction.inCachedGuild()) {
      return interaction.reply({
        content: t(interaction.locale, 'errors.guildOnly'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const missing = lacksDefaultPermissions(
      this.data.default_member_permissions,
      interaction.memberPermissions,
    );
    if (missing !== null) return refuseMissing(interaction, missing);
    const wait = this.cooldowns.remaining(interaction.user.id, this.cooldown);
    if (wait > 0) return replyCooldown(interaction, wait);
    return this.instance.execute(interaction);
  }
}

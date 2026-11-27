import { setTimeout as sleep } from 'node:timers/promises';
import {
  ApplicationCommandOptionType,
  type AutocompleteInteraction,
  type Channel,
  type ChatInputCommandInteraction,
  type CommandInteractionOption,
  ComponentType,
  Events,
  type GuildMember,
  type Interaction,
  type Message,
  type MessageComponentInteraction,
  type MessageContextMenuCommandInteraction,
  MessageFlags,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
  PermissionsBitField,
  type UserContextMenuCommandInteraction,
} from 'discord.js';
import { inject, On, type PluginCaller, type PluginScope } from '@/core';
import { isCommandDisabled } from '@/core/command-toggles';
import { recordUsage } from '@/core/command-usage';
import { Cooldowns, replyCooldown } from '@/core/cooldown';
import { translator } from '@/i18n';
import {
  type ContextKind,
  channelData,
  guildData,
  memberData,
  roleData,
} from '../discord-data.service';
import { PluginActionsService } from '../plugin-actions.service';
import {
  type Invocation,
  type LoadedPlugin,
  type PluginAction,
  PluginCallError,
  PluginEngineService,
} from '../plugin-engine.service';
import { PluginManifestService } from '../plugin-manifest.service';
import { PluginRegistryService } from '../plugin-registry.service';
import { PluginRenderService } from '../plugin-render.service';

const cooldownSeconds = 2;
// Discord drops an interaction that isn't answered within 3 seconds. A plugin that hasn't
// answered by this point gets a "thinking…" state first, and its answer when it's ready.
const acknowledgeAfterMs = 2000;

type Answerable =
  | ChatInputCommandInteraction
  | UserContextMenuCommandInteraction
  | MessageContextMenuCommandInteraction
  | MessageComponentInteraction
  | ModalSubmitInteraction;
type Resolved = NonNullable<Invocation['resolved']>;

// Built from what discord.js already cached for this interaction: no API calls.
function pushedContext(
  interaction: Answerable | AutocompleteInteraction,
  wanted: ContextKind[],
): Invocation['context'] {
  if (wanted.length === 0 || !interaction.inCachedGuild()) return undefined;
  return {
    ...(wanted.includes('member') && { member: memberData(interaction.member) }),
    ...(wanted.includes('guild') && { guild: guildData(interaction.guild) }),
    ...(wanted.includes('channel') &&
      interaction.channel && { channel: channelData(interaction.channel) }),
  };
}

function base(
  interaction: Answerable | AutocompleteInteraction,
  plugin: LoadedPlugin,
  kind: Invocation['kind'],
): Invocation {
  return {
    kind,
    command: '',
    subcommand: null,
    options: {},
    userId: interaction.user.id,
    guildId: interaction.guildId ?? `dm:${interaction.user.id}`,
    channelId: interaction.channelId ?? '',
    locale: interaction.locale,
    // Administrator implies every permission; spell them out so plugins needn't know that.
    permissions: interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ? new PermissionsBitField(PermissionsBitField.All).toArray()
      : (interaction.memberPermissions?.toArray() ?? []),
    context: pushedContext(interaction, plugin.context),
    resolved: { members: {}, roles: {}, channels: {} },
  };
}

function commandInput(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
  plugin: LoadedPlugin,
): Invocation {
  const input = base(
    interaction,
    plugin,
    interaction.isAutocomplete() ? 'autocomplete' : 'command',
  );
  const [first] = interaction.options.data;
  const subcommand = first?.type === ApplicationCommandOptionType.Subcommand ? first : undefined;
  const resolved = input.resolved as Resolved;
  const given: readonly CommandInteractionOption[] =
    subcommand?.options ?? interaction.options.data;
  for (const option of given) {
    if (option.value !== undefined) input.options[option.name] = option.value;
    // Discord sends the picked member, role or channel with the interaction; pass it on for free.
    if (option.member && 'guild' in option.member) {
      const member = option.member as GuildMember;
      resolved.members[member.id] = memberData(member);
    }
    if (option.role) resolved.roles[option.role.id] = roleData(option.role);
    if (option.channel && 'type' in option.channel)
      resolved.channels[option.channel.id] = channelData(option.channel as Channel);
  }
  return { ...input, command: interaction.commandName, subcommand: subcommand?.name ?? null };
}

function messageData(message: Message) {
  return {
    id: message.id,
    channelId: message.channelId,
    authorId: message.author.id,
    content: message.content,
    attachments: message.attachments.map((a) => a.url),
  };
}

function componentInput(
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
  plugin: LoadedPlugin,
  id: string,
): Invocation {
  const kind = interaction.isModalSubmit() ? 'modal' : interaction.isButton() ? 'button' : 'select';
  const input = base(interaction, plugin, kind);
  const resolved = input.resolved as Resolved;
  const values: string[] = [];
  const fields: Record<string, string> = {};
  if (interaction.isAnySelectMenu()) {
    values.push(...interaction.values);
    if (interaction.isUserSelectMenu() || interaction.isMentionableSelectMenu()) {
      for (const member of interaction.members.values()) {
        if ('guild' in member) resolved.members[member.id] = memberData(member as GuildMember);
      }
    }
    if (interaction.isRoleSelectMenu() || interaction.isMentionableSelectMenu()) {
      for (const role of interaction.roles.values()) resolved.roles[role.id] = roleData(role);
    }
    if (interaction.isChannelSelectMenu()) {
      for (const channel of interaction.channels.values()) {
        if ('type' in channel) resolved.channels[channel.id] = channelData(channel as Channel);
      }
    }
  }
  if (interaction.isModalSubmit()) {
    for (const field of interaction.fields.fields.values()) {
      if (field.type === ComponentType.TextInput) fields[field.customId] = field.value;
    }
  }
  const message = 'message' in interaction ? interaction.message : null;
  return { ...input, component: { id, values, fields, messageId: message?.id ?? null } };
}

@On(Events.InteractionCreate)
export class InteractionCreateEvent {
  private readonly registry = inject(PluginRegistryService);
  private readonly engine = inject(PluginEngineService);
  private readonly render = inject(PluginRenderService);
  private readonly manifests = inject(PluginManifestService);
  private readonly actions = inject(PluginActionsService);
  private readonly cooldowns = new Cooldowns();

  async execute(interaction: Interaction) {
    if (interaction.isAutocomplete()) return this.autocomplete(interaction);

    if (interaction.isChatInputCommand()) {
      const entry = this.registry.command(interaction.commandName);
      if (!entry) return;
      if (entry.spec.guildOnly && !interaction.inGuild()) {
        return this.fail(interaction, 'guildOnly', entry.plugin.id);
      }
      if (isCommandDisabled(entry.spec.name)) return undefined;
      if (await this.refuse(interaction, entry.plugin, entry.spec)) return;
      if (interaction.inGuild()) {
        recordUsage(interaction.guildId, entry.spec.name, interaction.user.id, 'plugin');
      }
      return this.answer(interaction, entry.plugin, commandInput(interaction, entry.plugin));
    }

    if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
      const type = interaction.isUserContextMenuCommand() ? 'user' : 'message';
      const entry = this.registry.menu(type, interaction.commandName);
      if (!entry || !interaction.inGuild()) return;
      if (await this.refuse(interaction, entry.plugin, entry.spec)) return;
      const input = base(interaction, entry.plugin, type === 'user' ? 'userMenu' : 'messageMenu');
      input.command = interaction.commandName;
      if (interaction.isUserContextMenuCommand()) {
        const member = interaction.targetMember;
        input.target = {
          userId: interaction.targetId,
          member: member && 'guild' in member ? memberData(member as GuildMember) : null,
          message: null,
        };
      } else {
        input.target = {
          userId: interaction.targetMessage.author.id,
          member: null,
          message: messageData(interaction.targetMessage),
        };
      }
      return this.answer(interaction, entry.plugin, input);
    }

    if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
      const parsed = this.render.parseCustomId(interaction.customId);
      if (!parsed) return;
      const plugin = this.registry.get(parsed.pluginId);
      if (!plugin) return this.fail(interaction, 'expired', parsed.pluginId);
      return this.answer(interaction, plugin, componentInput(interaction, plugin, parsed.id));
    }
    return undefined;
  }

  private async autocomplete(interaction: AutocompleteInteraction) {
    const entry = this.registry.command(interaction.commandName);
    if (!entry || isCommandDisabled(entry.spec.name)) return;
    const focused = interaction.options.getFocused(true);
    const input = commandInput(interaction, entry.plugin);
    const choices = await this.engine
      .autocomplete(
        entry.plugin,
        { ...input, focused: { name: focused.name, value: String(focused.value) } },
        this.caller(interaction),
      )
      .catch(() => []);
    return interaction.respond(choices);
  }

  /**
   * Refuses members without the command's default permissions. Server admins can open a command
   * to anyone in Integrations, so the default alone is not enough. Also applies the cooldown.
   */
  private async refuse(
    interaction:
      | ChatInputCommandInteraction
      | UserContextMenuCommandInteraction
      | MessageContextMenuCommandInteraction,
    plugin: LoadedPlugin,
    spec: { name: string; defaultMemberPermissions?: string[] },
  ): Promise<boolean> {
    const required = this.manifests.requiredPermissions(spec);
    if (required !== undefined && !interaction.memberPermissions?.has(required)) {
      const missing = new PermissionsBitField(required)
        .remove(interaction.memberPermissions ?? 0n)
        .toArray();
      await this.fail(interaction, 'forbidden', plugin.id, missing.join(', '));
      return true;
    }
    const wait = this.cooldowns.remaining(`${interaction.user.id}:${spec.name}`, cooldownSeconds);
    if (wait > 0) {
      await replyCooldown(interaction, wait);
      return true;
    }
    return false;
  }

  private caller(interaction: Answerable | AutocompleteInteraction): PluginCaller {
    return {
      userId: interaction.user.id,
      permissions: interaction.memberPermissions?.bitfield ?? 0n,
    };
  }

  private async answer(interaction: Answerable, plugin: LoadedPlugin, input: Invocation) {
    const running = this.engine.interact(plugin, input, this.caller(interaction));
    const settled = running.then(
      () => true,
      () => true,
    );
    const onMessage =
      interaction.isMessageComponent() ||
      (interaction.isModalSubmit() && interaction.isFromMessage());
    let deferred: 'reply' | 'update' | null = null;
    if (!(await Promise.race([settled, sleep(acknowledgeAfterMs).then(() => false)]))) {
      if (onMessage) await (interaction as MessageComponentInteraction).deferUpdate();
      else await interaction.deferReply();
      deferred = onMessage ? 'update' : 'reply';
    }

    let actions: PluginAction[];
    try {
      actions = await running;
    } catch (error) {
      if (!(error instanceof PluginCallError)) throw error;
      return this.fail(interaction, error.reason, plugin.id);
    }
    if (actions.length === 0) {
      // A click may need no visible answer; acknowledging it keeps Discord from showing an error.
      if (onMessage && !deferred) return (interaction as MessageComponentInteraction).deferUpdate();
      if (onMessage) return undefined;
      return this.fail(interaction, 'empty', plugin.id);
    }

    const scope: PluginScope = {
      pluginId: plugin.id,
      guildId: input.guildId,
      channelId: input.channelId,
      caller: this.caller(interaction),
    };
    let deferredAnswered = false;
    for (const action of actions) {
      if (action.type === 'modal') {
        if (deferred || interaction.isModalSubmit() || !('showModal' in interaction)) {
          return this.fail(interaction, 'lateModal', plugin.id);
        }
        return interaction.showModal(this.render.modal(plugin.id, action));
      }

      const body = this.render.message(plugin.id, action);
      if (action.type === 'update') {
        if (!onMessage) return this.fail(interaction, 'invalid', plugin.id);
        if (deferred || interaction.replied) await interaction.editReply(body);
        else await (interaction as MessageComponentInteraction).update(body);
        continue;
      }

      const ephemeral = action.ephemeral ?? false;
      const flags = ephemeral ? MessageFlags.Ephemeral : undefined;
      let posted: Message | null = null;
      if (!interaction.replied && !interaction.deferred) {
        const response = await interaction.reply({ ...body, flags, withResponse: true });
        posted = response.resource?.message ?? null;
      } else if (deferred === 'reply' && !deferredAnswered) {
        deferredAnswered = true;
        if (ephemeral) {
          // The "thinking…" message was public; it can't turn private, so it is replaced.
          await interaction.followUp({ ...body, flags });
          await interaction.deleteReply().catch(() => undefined);
        } else {
          posted = await interaction.editReply(body);
        }
      } else {
        posted = await interaction.followUp({ ...body, flags });
      }
      if (posted && !ephemeral && interaction.inGuild()) {
        await this.actions.remember(scope, posted.channelId, posted.id);
      }
    }
    return undefined;
  }

  private async fail(
    interaction: Answerable,
    reason:
      | 'timeout'
      | 'crash'
      | 'invalid'
      | 'empty'
      | 'expired'
      | 'forbidden'
      | 'lateModal'
      | 'guildOnly',
    plugin: string,
    permissions = '',
  ) {
    const content = translator(interaction.locale)(`plugins.replies.${reason}`, {
      plugin,
      permissions,
    });
    const onMessage =
      interaction.isMessageComponent() ||
      (interaction.isModalSubmit() && interaction.isFromMessage());
    // After deferUpdate, editReply would overwrite the message the button is on.
    if (interaction.deferred && !interaction.replied && !onMessage) {
      await interaction.editReply({ content, embeds: [], components: [] });
    } else if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  }
}

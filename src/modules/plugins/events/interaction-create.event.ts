import {
  ApplicationCommandOptionType,
  type AutocompleteInteraction,
  type Channel,
  type ChatInputCommandInteraction,
  type CommandInteractionOption,
  Events,
  type GuildMember,
  type Interaction,
  MessageFlags,
} from 'discord.js';
import { inject, On } from '@/core';
import { Cooldowns, replyCooldown } from '@/core/cooldown';
import { t, translator } from '@/i18n';
import {
  type ContextKind,
  channelData,
  guildData,
  memberData,
  roleData,
} from '../discord-data.service';
import { type CommandInput, PluginCallError, PluginEngineService } from '../plugin-engine.service';
import { PluginRegistryService } from '../plugin-registry.service';

const cooldownSeconds = 2;

// Built from what discord.js already cached for this interaction: no API calls, no plugin round trip.
function pushedContext(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
  wanted: ContextKind[],
): CommandInput['context'] {
  if (wanted.length === 0 || !interaction.inCachedGuild()) return undefined;
  return {
    ...(wanted.includes('member') && { member: memberData(interaction.member) }),
    ...(wanted.includes('guild') && { guild: guildData(interaction.guild) }),
    ...(wanted.includes('channel') &&
      interaction.channel && { channel: channelData(interaction.channel) }),
  };
}

function contextOf(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
  wanted: ContextKind[] = [],
): CommandInput {
  const [first] = interaction.options.data;
  const subcommand = first?.type === ApplicationCommandOptionType.Subcommand ? first : undefined;
  const values: CommandInput['options'] = {};
  const resolved: NonNullable<CommandInput['resolved']> = { members: {}, roles: {}, channels: {} };
  const given: readonly CommandInteractionOption[] =
    subcommand?.options ?? interaction.options.data;
  for (const option of given) {
    if (option.value !== undefined) values[option.name] = option.value;
    // Discord sends the picked member, role or channel with the interaction; pass it on for free.
    if (option.member && 'guild' in option.member) {
      const member = option.member as GuildMember;
      resolved.members[member.id] = memberData(member);
    }
    if (option.role) resolved.roles[option.role.id] = roleData(option.role);
    if (option.channel && 'type' in option.channel)
      resolved.channels[option.channel.id] = channelData(option.channel as Channel);
  }
  return {
    command: interaction.commandName,
    subcommand: subcommand?.name ?? null,
    options: values,
    userId: interaction.user.id,
    guildId: interaction.guildId ?? `dm:${interaction.user.id}`,
    channelId: interaction.channelId,
    locale: interaction.locale,
    context: pushedContext(interaction, wanted),
    resolved,
  };
}

@On(Events.InteractionCreate)
export class InteractionCreateEvent {
  private readonly registry = inject(PluginRegistryService);
  private readonly engine = inject(PluginEngineService);
  private readonly cooldowns = new Cooldowns();

  async execute(interaction: Interaction) {
    if (interaction.isAutocomplete()) return this.autocomplete(interaction);
    if (!interaction.isChatInputCommand()) return;
    const entry = this.registry.command(interaction.commandName);
    if (!entry) return;
    const { plugin, spec } = entry;
    const tr = translator(interaction.locale);

    if (spec.guildOnly && !interaction.inGuild()) {
      return interaction.reply({
        content: t(interaction.locale, 'errors.guildOnly'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const wait = this.cooldowns.remaining(`${interaction.user.id}:${spec.name}`, cooldownSeconds);
    if (wait > 0) return replyCooldown(interaction, wait);

    try {
      const [first, ...rest] = await this.engine.run(
        plugin,
        contextOf(interaction, plugin.context),
      );
      if (!first) {
        return interaction.reply({
          content: tr('plugins.replies.empty', { plugin: plugin.id }),
          flags: MessageFlags.Ephemeral,
        });
      }
      const send = (action: typeof first) => ({
        content: action.content,
        allowedMentions: { parse: [] as [] },
        ...(action.ephemeral && { flags: MessageFlags.Ephemeral as const }),
      });
      await interaction.reply(send(first));
      for (const action of rest) await interaction.followUp(send(action));
    } catch (error) {
      if (!(error instanceof PluginCallError)) throw error;
      return interaction.reply({
        content: tr(`plugins.replies.${error.reason}`, { plugin: plugin.id }),
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async autocomplete(interaction: AutocompleteInteraction) {
    const entry = this.registry.command(interaction.commandName);
    if (!entry) return;
    const focused = interaction.options.getFocused(true);
    const choices = await this.engine
      .autocomplete(entry.plugin, {
        ...contextOf(interaction, entry.plugin.context),
        focused: { name: focused.name, value: String(focused.value) },
      })
      .catch(() => []);
    return interaction.respond(choices);
  }
}

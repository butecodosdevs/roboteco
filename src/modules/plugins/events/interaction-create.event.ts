import {
  ApplicationCommandOptionType,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type CommandInteractionOption,
  Events,
  type Interaction,
  MessageFlags,
} from 'discord.js';
import { inject, On } from '@/core';
import { Cooldowns, replyCooldown } from '@/core/cooldown';
import { t, translator } from '@/i18n';
import {
  type CommandContext,
  type OptionValue,
  PluginCallError,
  PluginEngineService,
} from '../plugin-engine.service';
import { PluginRegistryService } from '../plugin-registry.service';

const cooldownSeconds = 2;

function contextOf(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
): CommandContext {
  const [first] = interaction.options.data;
  const subcommand = first?.type === ApplicationCommandOptionType.Subcommand ? first : undefined;
  const values: Record<string, OptionValue> = {};
  const given: readonly CommandInteractionOption[] =
    subcommand?.options ?? interaction.options.data;
  for (const option of given) {
    if (option.value !== undefined) values[option.name] = option.value;
  }
  return {
    command: interaction.commandName,
    subcommand: subcommand?.name ?? null,
    options: values,
    userId: interaction.user.id,
    guildId: interaction.guildId ?? `dm:${interaction.user.id}`,
    channelId: interaction.channelId,
    locale: interaction.locale,
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
      const [first, ...rest] = await this.engine.run(plugin, contextOf(interaction));
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
        ...contextOf(interaction),
        focused: { name: focused.name, value: String(focused.value) },
      })
      .catch(() => []);
    return interaction.respond(choices);
  }
}

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  MessageFlags,
  RoleSelectMenuBuilder,
  SlashCommandSubcommandBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} from 'discord.js';
import {
  customId,
  type GuildAutocompleteInteraction,
  type GuildInteraction,
  Subcommand,
} from '@/core';
import { localize, translator } from '@/i18n';
import { FidelityButton } from '../../components/fidelity.button';
import { FidelitySelect } from '../../components/fidelity.select';

/**
 * Exists so `/dev record` can capture what Discord sends for each option type, component and menu.
 * tests/plugins/recorded.test.ts replays those payloads into a plugin that declares the same names.
 */
@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'dev.fidelity')
    .addStringOption((o) => localize(o, 'dev.options.text').setRequired(true).setAutocomplete(true))
    .addIntegerOption((o) => localize(o, 'dev.options.number'))
    .addNumberOption((o) => localize(o, 'dev.options.ratio'))
    .addBooleanOption((o) => localize(o, 'dev.options.flag'))
    .addUserOption((o) => localize(o, 'dev.options.user'))
    .addChannelOption((o) => localize(o, 'dev.options.place'))
    .addRoleOption((o) => localize(o, 'dev.options.group')),
)
export class FidelitySubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const row = <
      T extends
        | ButtonBuilder
        | StringSelectMenuBuilder
        | UserSelectMenuBuilder
        | RoleSelectMenuBuilder
        | ChannelSelectMenuBuilder,
    >(
      component: T,
    ) => new ActionRowBuilder<T>().addComponents(component);
    return interaction.reply({
      content: tr('dev.panel.content'),
      flags: MessageFlags.Ephemeral,
      components: [
        row(
          new ButtonBuilder()
            .setCustomId(customId(FidelityButton))
            .setStyle(ButtonStyle.Primary)
            .setLabel(tr('dev.panel.form')),
        ),
        row(
          new StringSelectMenuBuilder()
            .setCustomId(customId(FidelitySelect, 'pick'))
            .setPlaceholder(tr('dev.panel.pick'))
            .setMaxValues(2)
            .addOptions(
              { label: tr('dev.panel.red'), value: 'red' },
              { label: tr('dev.panel.blue'), value: 'blue' },
            ),
        ),
        row(
          new UserSelectMenuBuilder()
            .setCustomId(customId(FidelitySelect, 'who'))
            .setPlaceholder(tr('dev.panel.who'))
            .setMaxValues(5),
        ),
        row(
          new RoleSelectMenuBuilder()
            .setCustomId(customId(FidelitySelect, 'groups'))
            .setPlaceholder(tr('dev.panel.groups'))
            .setMaxValues(5),
        ),
        row(
          new ChannelSelectMenuBuilder()
            .setCustomId(customId(FidelitySelect, 'where'))
            .setPlaceholder(tr('dev.panel.where'))
            .setMaxValues(5),
        ),
      ],
    });
  }

  async autocomplete(interaction: GuildAutocompleteInteraction) {
    const typed = interaction.options.getFocused() || '…';
    return interaction.respond([{ name: typed.slice(0, 100), value: typed.slice(0, 100) }]);
  }
}

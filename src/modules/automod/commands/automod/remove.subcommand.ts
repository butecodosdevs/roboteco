import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildAutocompleteInteraction, type GuildInteraction, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'automod.remove').addStringOption((opt) =>
    localize(opt, 'automod.options.rule').setRequired(true).setAutocomplete(true),
  ),
)
export class RemoveSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const rules = await interaction.guild.autoModerationRules.fetch();
    const rule = rules.get(interaction.options.getString('rule', true));
    if (!rule)
      return interaction.reply({
        content: tr('automod.replies.notFound'),
        flags: MessageFlags.Ephemeral,
      });
    await rule.delete('Removed with /automod');
    return interaction.reply({
      content: tr('automod.replies.removed', { name: rule.name }),
      flags: MessageFlags.Ephemeral,
    });
  }

  async autocomplete(interaction: GuildAutocompleteInteraction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const rules = await interaction.guild.autoModerationRules.fetch().catch(() => null);
    const choices = [...(rules?.values() ?? [])]
      .filter((rule) => rule.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((rule) => ({ name: rule.name.slice(0, 100), value: rule.id }));
    return interaction.respond(choices);
  }
}

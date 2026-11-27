import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import {
  type GuildAutocompleteInteraction,
  type GuildInteraction,
  inject,
  Subcommand,
} from '@/core';
import { localize, t } from '@/i18n';
import { TagsService } from '../../tags.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tags.show').addStringOption((opt) =>
    localize(opt, 'tags.options.name').setRequired(true).setMaxLength(32).setAutocomplete(true),
  ),
)
export class ShowSubcommand {
  private readonly tags = inject(TagsService);

  async execute(interaction: GuildInteraction) {
    const name = interaction.options.getString('name', true).toLowerCase();
    const content = await this.tags.use(interaction.guildId, name);
    if (!content) {
      return interaction.reply({
        content: t(interaction.locale, 'tags.replies.notFound', { name }),
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.reply({ content, allowedMentions: { parse: [] } });
  }

  async autocomplete(interaction: GuildAutocompleteInteraction) {
    const names = await this.tags.search(interaction.guildId, interaction.options.getFocused());
    return interaction.respond(names.map((name) => ({ name, value: name })));
  }
}

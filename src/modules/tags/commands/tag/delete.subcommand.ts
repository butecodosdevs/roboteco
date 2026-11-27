import { MessageFlags, PermissionFlagsBits, SlashCommandSubcommandBuilder } from 'discord.js';
import {
  type GuildAutocompleteInteraction,
  type GuildInteraction,
  inject,
  Subcommand,
} from '@/core';
import { localize, translator } from '@/i18n';
import { TagsService } from '../../tags.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tags.delete').addStringOption((opt) =>
    localize(opt, 'tags.options.name').setRequired(true).setMaxLength(32).setAutocomplete(true),
  ),
)
export class DeleteSubcommand {
  private readonly tags = inject(TagsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const name = interaction.options.getString('name', true).toLowerCase();
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });

    const tag = await this.tags.get(interaction.guildId, name);
    if (!tag) return reply(tr('tags.replies.notFound', { name }));
    const canDelete =
      tag.authorId === interaction.user.id ||
      interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages);
    if (!canDelete) return reply(tr('tags.replies.notAllowed', { name }));

    await this.tags.remove(interaction.guildId, name);
    return reply(tr('tags.replies.deleted', { name }));
  }

  async autocomplete(interaction: GuildAutocompleteInteraction) {
    const names = await this.tags.search(interaction.guildId, interaction.options.getFocused());
    return interaction.respond(names.map((name) => ({ name, value: name })));
  }
}

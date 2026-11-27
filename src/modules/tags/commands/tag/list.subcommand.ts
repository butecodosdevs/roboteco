import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { TagsService } from '../../tags.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'tags.list'))
export class ListSubcommand {
  private readonly tags = inject(TagsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const names = await this.tags.names(interaction.guildId);
    if (names.length === 0) {
      return interaction.reply({
        content: tr('tags.replies.empty'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const embed = new EmbedBuilder()
      .setTitle(tr('tags.replies.listTitle', { count: names.length }))
      .setDescription(
        names
          .map((name) => `\`${name}\``)
          .join(', ')
          .slice(0, 4096),
      );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

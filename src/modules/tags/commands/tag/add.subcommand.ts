import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { TagsService } from '../../tags.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tags.add')
    .addStringOption((opt) => localize(opt, 'tags.options.name').setRequired(true).setMaxLength(32))
    .addStringOption((opt) =>
      localize(opt, 'tags.options.content').setRequired(true).setMaxLength(2000),
    ),
  { cooldown: 10 },
)
export class AddSubcommand {
  private readonly tags = inject(TagsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const name = interaction.options.getString('name', true).toLowerCase();
    const content = interaction.options.getString('content', true);
    const saved = await this.tags.add(interaction.guildId, name, content, interaction.user.id);
    return interaction.reply({
      content: tr(saved ? 'tags.replies.saved' : 'tags.replies.exists', { name }),
      flags: MessageFlags.Ephemeral,
    });
  }
}

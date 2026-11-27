import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { RemindersService } from '../../reminders.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'reminders.list'))
export class ListSubcommand {
  private readonly reminders = inject(RemindersService);

  async execute(interaction: ChatInputCommandInteraction) {
    const tr = translator(interaction.locale);
    const list = await this.reminders.list(interaction.user.id);
    if (list.length === 0) {
      return interaction.reply({
        content: tr('reminders.replies.none'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const lines = list.map((r) =>
      tr('reminders.replies.line', {
        id: r.id,
        when: `<t:${Math.floor(r.remindAt.getTime() / 1000)}:R>`,
        text: r.text.slice(0, 100),
      }),
    );
    const embed = new EmbedBuilder()
      .setTitle(tr('reminders.replies.listTitle'))
      .setDescription(lines.join('\n').slice(0, 4096));
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

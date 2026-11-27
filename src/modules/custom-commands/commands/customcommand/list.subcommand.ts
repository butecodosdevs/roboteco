import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { CustomCommandsService } from '../../custom-commands.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'customCommands.list'))
export class ListSubcommand {
  private readonly commands = inject(CustomCommandsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const list = await this.commands.list(interaction.guildId);
    if (list.length === 0) {
      return interaction.reply({
        content: tr('customCommands.replies.none'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const embed = new EmbedBuilder()
      .setTitle(tr('customCommands.replies.listTitle'))
      .setDescription(
        list
          .map((c) => `\`/${c.name}\` · ${c.response.slice(0, 60)}`)
          .join('\n')
          .slice(0, 4096),
      );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

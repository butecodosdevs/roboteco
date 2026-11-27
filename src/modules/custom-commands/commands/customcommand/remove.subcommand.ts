import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import {
  type GuildAutocompleteInteraction,
  type GuildInteraction,
  inject,
  Subcommand,
} from '@/core';
import { localize, t } from '@/i18n';
import { CustomCommandsService } from '../../custom-commands.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'customCommands.remove').addStringOption((opt) =>
    localize(opt, 'customCommands.options.name').setRequired(true).setAutocomplete(true),
  ),
)
export class RemoveSubcommand {
  private readonly commands = inject(CustomCommandsService);

  async execute(interaction: GuildInteraction) {
    const name = interaction.options.getString('name', true).toLowerCase();
    const removed = await this.commands.remove(interaction.guild, name);
    return interaction.reply({
      content: t(
        interaction.locale,
        removed ? 'customCommands.replies.removed' : 'customCommands.replies.notFound',
        {
          name,
        },
      ),
      flags: MessageFlags.Ephemeral,
    });
  }

  async autocomplete(interaction: GuildAutocompleteInteraction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const names = (await this.commands.list(interaction.guildId))
      .map((c) => c.name)
      .filter((name) => name.startsWith(focused))
      .slice(0, 25);
    return interaction.respond(names.map((name) => ({ name, value: name })));
  }
}

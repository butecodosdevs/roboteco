import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { PluginRegistryService } from '../../plugin-registry.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'plugins.list'))
export class ListSubcommand {
  private readonly registry = inject(PluginRegistryService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const plugins = this.registry.all();
    if (plugins.length === 0) {
      return interaction.reply({
        content: tr('plugins.replies.none'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const lines = plugins.map((plugin) =>
      tr('plugins.replies.line', {
        plugin: plugin.id,
        version: plugin.version,
        commands: plugin.commands.map((c) => `\`/${c.name}\``).join(', '),
        permissions: plugin.permissions.join(', ') || tr('plugins.replies.noPermissions'),
      }),
    );
    const embed = new EmbedBuilder()
      .setTitle(tr('plugins.replies.listTitle'))
      .setDescription(lines.join('\n'));
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

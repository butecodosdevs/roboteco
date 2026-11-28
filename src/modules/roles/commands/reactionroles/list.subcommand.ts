import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { ReactionRolesService } from '../../reaction-roles.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'roles.reaction.list'))
export class ListSubcommand {
  private readonly reactionRoles = inject(ReactionRolesService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const rows = await this.reactionRoles.list(interaction.guildId);
    if (rows.length === 0)
      return interaction.reply({
        content: tr('roles.reaction.replies.none'),
        flags: MessageFlags.Ephemeral,
      });
    const byMessage = new Map<string, typeof rows>();
    for (const row of rows)
      byMessage.set(row.messageId, [...(byMessage.get(row.messageId) ?? []), row]);
    const lines = [...byMessage.values()].map((group) => {
      const [first] = group;
      const url = `https://discord.com/channels/${interaction.guildId}/${first?.channelId}/${first?.messageId}`;
      const pairs = group.map(
        (row) => `${/^\d+$/.test(row.emoji) ? `<:e:${row.emoji}>` : row.emoji} <@&${row.roleId}>`,
      );
      return `${url}\n${pairs.join(' · ')}`;
    });
    const embed = new EmbedBuilder()
      .setTitle(tr('roles.reaction.replies.listTitle'))
      .setDescription(lines.join('\n\n').slice(0, 4096));
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

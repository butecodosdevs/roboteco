import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { parseEmoji, parseMessageRef, ReactionRolesService } from '../../reaction-roles.service';
import { findMessage } from './message-ref';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'roles.reaction.remove')
    .addStringOption((opt) =>
      localize(opt, 'roles.reaction.options.message').setRequired(true).setMaxLength(200),
    )
    .addStringOption((opt) => localize(opt, 'roles.reaction.options.emoji').setMaxLength(100))
    .addChannelOption((opt) =>
      localize(opt, 'roles.reaction.options.channel').addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
      ),
    ),
)
export class RemoveSubcommand {
  private readonly reactionRoles = inject(ReactionRolesService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const ref = parseMessageRef(interaction.options.getString('message', true));
    if (!ref)
      return interaction.reply({
        content: tr('roles.reaction.replies.messageNotFound'),
        flags: MessageFlags.Ephemeral,
      });
    const emojiInput = interaction.options.getString('emoji');
    const emoji = emojiInput ? parseEmoji(emojiInput.trim()) : undefined;
    if (emojiInput && !emoji) {
      return interaction.reply({
        content: tr('roles.reaction.replies.invalid', { items: emojiInput }),
        flags: MessageFlags.Ephemeral,
      });
    }
    const removed = await this.reactionRoles.remove(interaction.guildId, ref.messageId, emoji);
    const message = await findMessage(interaction);
    for (const row of removed) {
      await message?.reactions.cache
        .get(row.emoji)
        ?.users.remove(interaction.client.user.id)
        .catch(() => undefined);
    }
    return interaction.reply({
      content: tr('roles.reaction.replies.removed', { count: removed.length }),
      flags: MessageFlags.Ephemeral,
    });
  }
}

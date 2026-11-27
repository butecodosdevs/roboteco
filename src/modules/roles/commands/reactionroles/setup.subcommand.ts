import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import {
  maxReactionsPerMessage,
  parsePairs,
  ReactionRolesService,
} from '../../reaction-roles.service';
import { RolesService } from '../../roles.service';
import { findMessage } from './message-ref';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'roles.reaction.setup')
    .addStringOption((opt) =>
      localize(opt, 'roles.reaction.options.message').setRequired(true).setMaxLength(200),
    )
    .addStringOption((opt) =>
      localize(opt, 'roles.reaction.options.pairs').setRequired(true).setMaxLength(1500),
    )
    .addChannelOption((opt) =>
      localize(opt, 'roles.reaction.options.channel').addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
      ),
    ),
)
export class SetupSubcommand {
  private readonly reactionRoles = inject(ReactionRolesService);
  private readonly roles = inject(RolesService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const { guild } = interaction;
    const reply = (content: string) =>
      interaction.editReply({ content, allowedMentions: { parse: [] } });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return reply(tr('roles.replies.botPermission'));
    }
    const message = await findMessage(interaction);
    if (!message) return reply(tr('roles.reaction.replies.messageNotFound'));
    const me = guild.members.me;
    if (
      !message.channel
        .permissionsFor(me)
        .has([PermissionFlagsBits.AddReactions, PermissionFlagsBits.ReadMessageHistory])
    ) {
      return reply(
        tr('roles.reaction.replies.reactPermission', { channel: message.channel.toString() }),
      );
    }

    const { pairs, invalid } = parsePairs(interaction.options.getString('roles', true));
    const lines: string[] = [];
    if (invalid.length > 0)
      lines.push(tr('roles.reaction.replies.invalid', { items: invalid.join(', ') }));
    const seen = new Set<string>();
    let added = 0;
    for (const pair of pairs) {
      const role = guild.roles.cache.get(pair.roleId);
      const already = this.reactionRoles.roleFor(message.id, pair.emoji);
      if (seen.has(pair.emoji)) {
        lines.push(tr('roles.reaction.replies.duplicate', { emoji: pair.reaction }));
      } else if (!role || !this.roles.canAssign(guild, role)) {
        lines.push(tr('roles.replies.unassignable', { role: role?.toString() ?? pair.roleId }));
      } else if (!already && this.reactionRoles.count(message.id) >= maxReactionsPerMessage) {
        lines.push(tr('roles.reaction.replies.tooMany', { max: maxReactionsPerMessage }));
      } else if (
        !(await message
          .react(pair.reaction)
          .then(() => true)
          .catch(() => false))
      ) {
        lines.push(tr('roles.reaction.replies.reactFailed', { emoji: pair.reaction }));
      } else {
        await this.reactionRoles.add({
          messageId: message.id,
          emoji: pair.emoji,
          guildId: guild.id,
          channelId: message.channelId,
          roleId: role.id,
        });
        lines.push(
          tr('roles.reaction.replies.pair', { emoji: pair.reaction, role: role.toString() }),
        );
        added++;
      }
      seen.add(pair.emoji);
    }
    lines.unshift(tr('roles.reaction.replies.done', { count: added, url: message.url }));
    return reply(lines.join('\n'));
  }
}

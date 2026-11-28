import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command, type GuildInteraction, inject } from '@/core';
import { localize, translator } from '@/i18n';
import { ModLogService } from '../../mod-log.service';
import { ModerationService } from '../../moderation.service';

@Command({
  data: localize(new SlashCommandBuilder(), 'moderation.commands.purge')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) =>
      localize(opt, 'moderation.options.count').setRequired(true).setMinValue(1).setMaxValue(100),
    )
    .addUserOption((opt) => localize(opt, 'moderation.options.purgeUser')),
  guildOnly: true,
})
export class PurgeCommand {
  private readonly log = inject(ModLogService);
  private readonly moderation = inject(ModerationService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const { channel, guild } = interaction;
    if (!channel || !('bulkDelete' in channel)) {
      return interaction.reply({
        content: tr('moderation.errors.unsupportedChannel'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const me = guild.members.me;
    if (
      !me ||
      !channel
        .permissionsFor(me)
        .has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory])
    ) {
      return interaction.reply({
        content: tr('moderation.errors.botPermission', {
          permission: tr('moderation.permissions.manageMessages'),
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const count = interaction.options.getInteger('count', true);
    const user = interaction.options.getUser('user');
    const recent = await channel.messages.fetch({ limit: 100 });
    const targets = recent.filter((m) => !user || m.author.id === user.id).first(count);
    await this.moderation.expect(guild.id, 'purge', channel.id, interaction.user.id);
    const deleted = await channel.bulkDelete(targets, true);

    if (deleted.size === 0) return interaction.editReply(tr('moderation.replies.purgedNone'));
    await this.log.postPurge(guild, {
      moderatorId: interaction.user.id,
      channelId: channel.id,
      count: deleted.size,
      userId: user?.id,
    });
    return interaction.editReply(tr('moderation.replies.purged', { count: deleted.size }));
  }
}

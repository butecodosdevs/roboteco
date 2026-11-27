import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command, type GuildInteraction, inject } from '@/core';
import { localize } from '@/i18n';
import { ModerationService } from '../../moderation.service';

@Command({
  data: localize(new SlashCommandBuilder(), 'moderation.commands.kick')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) => localize(opt, 'moderation.options.user').setRequired(true))
    .addStringOption((opt) => localize(opt, 'moderation.options.reason').setMaxLength(400)),
  guildOnly: true,
})
export class KickCommand {
  private readonly moderation = inject(ModerationService);

  execute(interaction: GuildInteraction) {
    return this.moderation.apply(interaction, {
      action: 'kick',
      target: interaction.options.getUser('user', true),
      reason: interaction.options.getString('reason'),
      requireMember: true,
      run: async ({ member, auditReason }) => {
        await member?.kick(auditReason);
      },
    });
  }
}

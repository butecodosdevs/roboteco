import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command, type GuildInteraction, inject } from '@/core';
import { localize } from '@/i18n';
import { ModerationService } from '../../moderation.service';

@Command({
  data: localize(new SlashCommandBuilder(), 'moderation.commands.warn')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => localize(opt, 'moderation.options.user').setRequired(true))
    .addStringOption((opt) =>
      localize(opt, 'moderation.options.requiredReason').setRequired(true).setMaxLength(400),
    ),
  guildOnly: true,
})
export class WarnCommand {
  private readonly moderation = inject(ModerationService);

  execute(interaction: GuildInteraction) {
    return this.moderation.apply(interaction, {
      action: 'warn',
      target: interaction.options.getUser('user', true),
      reason: interaction.options.getString('reason', true),
      requireMember: true,
      run: async () => {},
    });
  }
}

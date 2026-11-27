import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command, type GuildInteraction, inject } from '@/core';
import { localize } from '@/i18n';
import { ModerationService } from '../../moderation.service';

@Command({
  data: localize(new SlashCommandBuilder(), 'moderation.commands.untimeout')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => localize(opt, 'moderation.options.user').setRequired(true))
    .addStringOption((opt) => localize(opt, 'moderation.options.reason').setMaxLength(400)),
  guildOnly: true,
})
export class UntimeoutCommand {
  private readonly moderation = inject(ModerationService);

  execute(interaction: GuildInteraction) {
    const target = interaction.options.getUser('user', true);
    return this.moderation.apply(interaction, {
      action: 'untimeout',
      target,
      reason: interaction.options.getString('reason'),
      requireMember: true,
      check: (member) =>
        member?.isCommunicationDisabled()
          ? undefined
          : { key: 'moderation.errors.notTimedOut', vars: { user: target.toString() } },
      run: async ({ member, auditReason }) => {
        await member?.timeout(null, auditReason);
      },
    });
  }
}

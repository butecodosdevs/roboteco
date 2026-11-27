import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command, type GuildInteraction, inject } from '@/core';
import { localize } from '@/i18n';
import { ModerationService } from '../../moderation.service';
import { TempBansService } from '../../temp-bans.service';

@Command({
  data: localize(new SlashCommandBuilder(), 'moderation.commands.unban')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) => localize(opt, 'moderation.options.bannedUser').setRequired(true))
    .addStringOption((opt) => localize(opt, 'moderation.options.reason').setMaxLength(400)),
  guildOnly: true,
})
export class UnbanCommand {
  private readonly moderation = inject(ModerationService);
  private readonly tempBans = inject(TempBansService);

  execute(interaction: GuildInteraction) {
    const target = interaction.options.getUser('user', true);
    return this.moderation.apply(interaction, {
      action: 'unban',
      target,
      reason: interaction.options.getString('reason'),
      check: async () => {
        const banned = await interaction.guild.bans.fetch(target.id).catch(() => null);
        return banned
          ? undefined
          : { key: 'moderation.errors.notBanned', vars: { user: target.toString() } };
      },
      run: async ({ auditReason }) => {
        await interaction.guild.members.unban(target, auditReason);
        await this.tempBans.cancel(interaction.guildId, target.id);
      },
    });
  }
}

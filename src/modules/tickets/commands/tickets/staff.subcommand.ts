import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, t } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tickets.staff').addRoleOption((opt) =>
    localize(opt, 'tickets.options.role').setRequired(true),
  ),
)
export class StaffSubcommand {
  async execute(interaction: GuildInteraction) {
    const role = interaction.options.getRole('role', true);
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      ticketsStaffRoleId: role.id,
    });
    return interaction.reply({
      content: t(interaction.locale, 'tickets.replies.staffSet', { role: role.toString() }),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

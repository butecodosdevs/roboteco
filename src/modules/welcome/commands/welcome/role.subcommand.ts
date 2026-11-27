import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { config } from '@/config';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'welcome.role').addRoleOption((opt) =>
    localize(opt, 'welcome.options.role'),
  ),
)
export class RoleSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const role = interaction.options.getRole('role');
    const me = interaction.guild.members.me;
    if (role && (role.managed || !me || me.roles.highest.comparePositionTo(role) <= 0)) {
      return interaction.reply({
        content: tr('welcome.replies.unassignable', { role: role.toString() }),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    }
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      welcomeRoleId: role?.id ?? null,
    });
    const content = role
      ? tr('welcome.replies.roleSet', { role: role.toString() })
      : tr('welcome.replies.roleCleared');
    const lines = [content];
    if (!config.privilegedIntents) lines.push(tr('welcome.replies.intentDisabled'));
    return interaction.reply({
      content: lines.join('\n'),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

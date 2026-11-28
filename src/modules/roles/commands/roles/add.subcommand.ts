import { MessageFlags, PermissionFlagsBits, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { refreshPicker } from '../../components/roles.select';
import { maxSelfRoles, RolesService } from '../../roles.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'roles.add')
    .addRoleOption((opt) => localize(opt, 'roles.options.role').setRequired(true))
    .addStringOption((opt) => localize(opt, 'roles.options.description').setMaxLength(100)),
)
export class AddSubcommand {
  private readonly roles = inject(RolesService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const role = interaction.options.getRole('role', true);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return reply(tr('roles.replies.botPermission'));
    }
    const refusal = this.roles.grantRefusal(interaction.member, role);
    if (refusal) return reply(tr(`roles.replies.${refusal}`, { role: role.toString() }));
    const current = await this.roles.list(interaction.guildId);
    if (current.length >= maxSelfRoles && !current.some((r) => r.roleId === role.id)) {
      return reply(tr('roles.replies.tooMany'));
    }
    await this.roles.add(
      interaction.guildId,
      role.id,
      interaction.options.getString('description'),
    );
    await refreshPicker(interaction.guild, await this.roles.list(interaction.guildId));
    return reply(tr('roles.replies.added', { role: role.toString() }));
  }
}

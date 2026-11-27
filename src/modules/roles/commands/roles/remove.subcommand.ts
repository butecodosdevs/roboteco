import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { refreshPicker } from '../../components/roles.select';
import { RolesService } from '../../roles.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'roles.remove').addRoleOption((opt) =>
    localize(opt, 'roles.options.role').setRequired(true),
  ),
)
export class RemoveSubcommand {
  private readonly roles = inject(RolesService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const role = interaction.options.getRole('role', true);
    const removed = await this.roles.remove(interaction.guildId, role.id);
    if (removed) await refreshPicker(interaction.guild, await this.roles.list(interaction.guildId));
    return interaction.reply({
      content: tr(removed ? 'roles.replies.removed' : 'roles.replies.notListed', {
        role: role.toString(),
      }),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { LevelsService } from '../../levels.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'levels.reward')
    .addIntegerOption((opt) =>
      localize(opt, 'levels.options.level').setRequired(true).setMinValue(1).setMaxValue(500),
    )
    .addRoleOption((opt) => localize(opt, 'levels.options.role').setRequired(true)),
)
export class RewardSubcommand {
  private readonly levels = inject(LevelsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const level = interaction.options.getInteger('level', true);
    const role = interaction.options.getRole('role', true);
    const me = interaction.guild.members.me;
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

    if (role.managed || !me || me.roles.highest.comparePositionTo(role) <= 0) {
      return reply(tr('levels.replies.unassignable', { role: role.toString() }));
    }
    await this.levels.setReward(interaction.guildId, level, role.id);
    return reply(tr('levels.replies.rewardSet', { level, role: role.toString() }));
  }
}

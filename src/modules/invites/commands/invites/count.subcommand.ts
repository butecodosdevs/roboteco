import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { config } from '@/config';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { InvitesService } from '../../invites.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'invites.count').addUserOption((opt) =>
    localize(opt, 'invites.options.user'),
  ),
)
export class CountSubcommand {
  private readonly invites = inject(InvitesService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const user = interaction.options.getUser('user') ?? interaction.user;
    const { active, total } = await this.invites.countFor(interaction.guildId, user.id);
    const lines = [tr('invites.replies.count', { user: user.toString(), active, total })];
    if (!config.privilegedIntents) lines.push(tr('invites.replies.intentDisabled'));
    return interaction.reply({
      content: lines.join('\n'),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

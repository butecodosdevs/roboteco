import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { eraseButtons } from '../../components/erase.button';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'privacy.delete'), { cooldown: 60 })
export class DeleteSubcommand {
  async execute(interaction: GuildInteraction) {
    const { user, locale } = interaction;
    return interaction.reply({
      content: t(locale, 'privacy.confirmSelf'),
      components: eraseButtons(locale, user.id, user.id, 'all'),
      flags: MessageFlags.Ephemeral,
    });
  }
}

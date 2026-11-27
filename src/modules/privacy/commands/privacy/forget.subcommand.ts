import { MessageFlags, PermissionFlagsBits, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { eraseButtons } from '../../components/erase.button';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'privacy.forget').addUserOption((opt) =>
    localize(opt, 'privacy.options.user').setRequired(true),
  ),
)
export class ForgetSubcommand {
  async execute(interaction: GuildInteraction) {
    const { locale } = interaction;
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: t(locale, 'privacy.replies.notAllowed'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const target = interaction.options.getUser('user', true);
    return interaction.reply({
      content: t(locale, 'privacy.confirmForget', { user: target.toString() }),
      components: eraseButtons(locale, interaction.user.id, target.id, 'guild'),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

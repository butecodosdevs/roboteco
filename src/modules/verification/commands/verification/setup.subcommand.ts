import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { customId, type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, t, translator } from '@/i18n';
import { VerifyButton } from '../../components/verify.button';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'verification.setup')
    .addChannelOption((opt) =>
      localize(opt, 'verification.options.channel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addRoleOption((opt) => localize(opt, 'verification.options.role').setRequired(true))
    .addIntegerOption((opt) =>
      localize(opt, 'verification.options.minAge').setMinValue(0).setMaxValue(365),
    ),
)
export class SetupSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const { guild } = interaction;
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);
    const role = interaction.options.getRole('role', true);

    const me = guild.members.me;
    if (
      role.managed ||
      role.id === guild.id ||
      !me ||
      me.roles.highest.comparePositionTo(role) <= 0
    ) {
      return reply(tr('verification.replies.unassignable', { role: role.toString() }));
    }

    const locale = guild.preferredLocale;
    const posted = await channel
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(t(locale, 'verification.panel.title'))
            .setDescription(t(locale, 'verification.panel.description')),
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(customId(VerifyButton))
              .setStyle(ButtonStyle.Success)
              .setEmoji('✅')
              .setLabel(t(locale, 'verification.panel.button')),
          ),
        ],
      })
      .then(() => true)
      .catch(() => false);
    if (!posted)
      return reply(tr('verification.replies.postFailed', { channel: channel.toString() }));

    await updateGuildSettings(guild.id, locale, {
      verificationRoleId: role.id,
      verificationMinAccountAgeDays: interaction.options.getInteger('min_account_age') ?? 0,
    });
    return reply(
      tr('verification.replies.posted', { channel: channel.toString(), role: role.toString() }),
    );
  }
}

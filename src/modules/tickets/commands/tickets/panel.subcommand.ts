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
import { localize, t, translator } from '@/i18n';
import { OpenTicketButton } from '../../components/open-ticket.button';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tickets.panel').addChannelOption((opt) =>
    localize(opt, 'tickets.options.channel')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true),
  ),
)
export class PanelSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const locale = interaction.guild.preferredLocale;
    const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);
    const sent = await channel
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(t(locale, 'tickets.panelMessage.title'))
            .setDescription(t(locale, 'tickets.panelMessage.description')),
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(customId(OpenTicketButton))
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🎫')
              .setLabel(t(locale, 'tickets.panelMessage.open')),
          ),
        ],
      })
      .then(() => true)
      .catch(() => false);
    return interaction.reply({
      content: tr(sent ? 'tickets.replies.panelPosted' : 'tickets.replies.postFailed', {
        channel: channel.toString(),
      }),
      flags: MessageFlags.Ephemeral,
    });
  }
}

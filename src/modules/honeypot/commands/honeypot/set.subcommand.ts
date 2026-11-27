import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { defaultLocale, localizations, localize, t, translator } from '@/i18n';
import { HoneypotService } from '../../honeypot.service';
import { type DeleteWindow, deleteWindows, windowKeys } from './delete-windows';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'honeypot.set')
    .addChannelOption((opt) =>
      localize(opt, 'honeypot.options.channel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addStringOption((opt) =>
      localize(opt, 'honeypot.options.deleteMessages').addChoices(
        ...windowKeys.map((w) => ({
          name: t(defaultLocale, `honeypot.windows.${w}`),
          name_localizations: localizations(`honeypot.windows.${w}`),
          value: w,
        })),
      ),
    ),
)
export class SetSubcommand {
  private readonly honeypots = inject(HoneypotService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const { guild } = interaction;

    if (!guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content: tr('honeypot.replies.missingBanPermission'),
        flags: MessageFlags.Ephemeral,
      });
    }

    const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);
    const window = (interaction.options.getString('delete_messages') ?? 'hour') as DeleteWindow;

    await this.honeypots.set(guild.id, guild.preferredLocale, {
      channelId: channel.id,
      deleteMessageSeconds: deleteWindows[window],
    });

    const warned = await channel
      .send(t(guild.preferredLocale, 'honeypot.warning'))
      .then(() => true)
      .catch(() => false);

    const lines = [tr('honeypot.replies.set', { channel: channel.toString() })];
    if (!warned) {
      lines.push(tr('honeypot.replies.warningFailed', { channel: channel.toString() }));
    }
    return interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
  }
}

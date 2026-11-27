import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { config } from '@/config';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { CountingService } from '../../counting.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'counting.channel').addChannelOption((opt) =>
    localize(opt, 'counting.options.channel').addChannelTypes(ChannelType.GuildText),
  ),
)
export class ChannelSubcommand {
  private readonly counting = inject(CountingService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const channel = interaction.options.getChannel('channel', false, [ChannelType.GuildText]);
    await this.counting.configure(interaction.guildId, channel?.id ?? null);
    const lines = [
      channel
        ? tr('counting.replies.set', { channel: channel.toString() })
        : tr('counting.replies.disabled'),
    ];
    if (channel && !config.privilegedIntents) lines.push(tr('counting.replies.intentDisabled'));
    return interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
  }
}

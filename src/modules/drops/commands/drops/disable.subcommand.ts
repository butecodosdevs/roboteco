import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { DropsService } from '../../drops.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'drops.disable').addChannelOption((opt) =>
    localize(opt, 'drops.options.channel').addChannelTypes(ChannelType.GuildText).setRequired(true),
  ),
)
export class DisableSubcommand {
  private readonly drops = inject(DropsService);

  async execute(interaction: GuildInteraction) {
    const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);
    const removed =
      this.drops.get(channel.id)?.guildId === interaction.guildId &&
      (await this.drops.disable(channel.id));
    return interaction.reply({
      content: t(
        interaction.locale,
        removed ? 'drops.replies.disabled' : 'drops.replies.notConfigured',
        {
          channel: channel.toString(),
        },
      ),
      flags: MessageFlags.Ephemeral,
    });
  }
}

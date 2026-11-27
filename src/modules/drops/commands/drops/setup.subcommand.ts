import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { DropsService } from '../../drops.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'drops.setup')
    .addChannelOption((opt) =>
      localize(opt, 'drops.options.channel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'drops.options.every').setRequired(true).setMinValue(10).setMaxValue(10_000),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'drops.options.xp').setRequired(true).setMinValue(1).setMaxValue(1000),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'drops.options.lifetime').setMinValue(15).setMaxValue(600),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'drops.options.winners').setMinValue(1).setMaxValue(10),
    ),
)
export class SetupSubcommand {
  private readonly drops = inject(DropsService);

  async execute(interaction: GuildInteraction) {
    const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);
    const every = interaction.options.getInteger('every', true);
    const xp = interaction.options.getInteger('xp', true);
    const winners = interaction.options.getInteger('winners') ?? 1;
    await this.drops.configure({
      guildId: interaction.guildId,
      channelId: channel.id,
      every,
      xp,
      lifetimeSeconds: interaction.options.getInteger('lifetime') ?? 60,
      winners,
    });
    return interaction.reply({
      content: t(interaction.locale, 'drops.replies.configured', {
        xp,
        every,
        winners,
        channel: channel.toString(),
      }),
      flags: MessageFlags.Ephemeral,
    });
  }
}

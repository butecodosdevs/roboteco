import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { TempVoiceService } from '../../temp-voice.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tempVoice.setup')
    .addChannelOption((opt) =>
      localize(opt, 'tempVoice.options.hub')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true),
    )
    .addChannelOption((opt) =>
      localize(opt, 'tempVoice.options.category').addChannelTypes(ChannelType.GuildCategory),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'tempVoice.options.hubLimit').setMinValue(0).setMaxValue(99),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'tempVoice.options.emptyAfter').setMinValue(0).setMaxValue(1440),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'tempVoice.options.idleAfter').setMinValue(0).setMaxValue(1440),
    ),
)
export class SetupSubcommand {
  private readonly tempVoice = inject(TempVoiceService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    if (!this.tempVoice.canManage(interaction.guild))
      return reply(tr('tempVoice.replies.botPermission'));
    const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildVoice]);
    const category = interaction.options.getChannel('category', false, [ChannelType.GuildCategory]);
    const emptyMinutes = interaction.options.getInteger('empty_after') ?? 1;
    const idleMinutes = interaction.options.getInteger('idle_after') ?? 10;
    await this.tempVoice.setHub({
      guildId: interaction.guildId,
      channelId: channel.id,
      categoryId: category?.id ?? channel.parentId,
      userLimit: interaction.options.getInteger('limit') ?? 0,
      emptyTimeoutSeconds: emptyMinutes * 60,
      idleTimeoutSeconds: idleMinutes * 60,
    });
    const lines = [
      tr('tempVoice.replies.hubSet', { channel: channel.toString() }),
      tr('tempVoice.replies.categoryRule', {
        category: category?.name ?? channel.parent?.name ?? tr('tempVoice.replies.noCategory'),
      }),
      tr('tempVoice.replies.emptyRule', { minutes: emptyMinutes }),
      idleMinutes
        ? tr('tempVoice.replies.idleRule', { minutes: idleMinutes })
        : tr('tempVoice.replies.idleOff'),
    ];
    return reply(lines.join('\n'));
  }
}

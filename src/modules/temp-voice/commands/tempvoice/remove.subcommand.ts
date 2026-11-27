import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { TempVoiceService } from '../../temp-voice.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tempVoice.remove').addChannelOption((opt) =>
    localize(opt, 'tempVoice.options.hub')
      .addChannelTypes(ChannelType.GuildVoice)
      .setRequired(true),
  ),
)
export class RemoveSubcommand {
  private readonly tempVoice = inject(TempVoiceService);

  async execute(interaction: GuildInteraction) {
    const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildVoice]);
    const removed = await this.tempVoice.removeHub(interaction.guildId, channel.id);
    return interaction.reply({
      content: t(
        interaction.locale,
        removed ? 'tempVoice.replies.hubRemoved' : 'tempVoice.replies.notHub',
        {
          channel: channel.toString(),
        },
      ),
      flags: MessageFlags.Ephemeral,
    });
  }
}

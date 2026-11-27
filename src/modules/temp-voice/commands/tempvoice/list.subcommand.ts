import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { TempVoiceService } from '../../temp-voice.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'tempVoice.list'))
export class ListSubcommand {
  private readonly tempVoice = inject(TempVoiceService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const hubs = await this.tempVoice.hubsOf(interaction.guildId);
    if (hubs.length === 0)
      return interaction.reply({
        content: tr('tempVoice.replies.noHubs'),
        flags: MessageFlags.Ephemeral,
      });
    const embed = new EmbedBuilder().setTitle(tr('tempVoice.replies.hubsTitle')).setDescription(
      hubs
        .map((hub) =>
          tr('tempVoice.replies.hubLine', {
            channel: `<#${hub.channelId}>`,
            limit: hub.userLimit || '∞',
            empty: hub.emptyTimeoutSeconds / 60,
            idle: hub.idleTimeoutSeconds ? hub.idleTimeoutSeconds / 60 : '—',
          }),
        )
        .join('\n'),
    );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

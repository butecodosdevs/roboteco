import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { HoneypotService } from '../../honeypot.service';
import { windowFor } from './delete-windows';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'honeypot.status'))
export class StatusSubcommand {
  private readonly honeypots = inject(HoneypotService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const config = this.honeypots.get(interaction.guildId);
    const content = config
      ? tr('honeypot.replies.status', {
          channel: `<#${config.channelId}>`,
          window: tr(`honeypot.windows.${windowFor(config.deleteMessageSeconds)}`),
        })
      : tr('honeypot.replies.notConfigured');
    return interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}

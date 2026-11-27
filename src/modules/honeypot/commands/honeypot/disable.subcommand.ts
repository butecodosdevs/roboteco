import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t } from '@/i18n';
import { HoneypotService } from '../../honeypot.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'honeypot.disable'))
export class DisableSubcommand {
  private readonly honeypots = inject(HoneypotService);

  async execute(interaction: GuildInteraction) {
    await this.honeypots.clear(interaction.guildId);
    return interaction.reply({
      content: t(interaction.locale, 'honeypot.replies.disabled'),
      flags: MessageFlags.Ephemeral,
    });
  }
}

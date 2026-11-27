import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize, translator } from '@/i18n';

@Command({ data: localize(new SlashCommandBuilder(), 'ping.command') })
export class PingCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const tr = translator(interaction.locale);
    const sent = await interaction.reply({ content: tr('ping.pending'), withResponse: true });
    const roundtrip =
      (sent.resource?.message?.createdTimestamp ?? Date.now()) - interaction.createdTimestamp;
    return interaction.editReply(tr('ping.result', { roundtrip, ws: interaction.client.ws.ping }));
  }
}

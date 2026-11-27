import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { currentRoom } from './current-room';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'tempVoice.lock'))
export class LockSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const current = await currentRoom(interaction);
    if (!current) return;
    await current.channel.permissionOverwrites.edit(interaction.guildId, { Connect: false });
    const content = tr('tempVoice.replies.locked');
    return interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

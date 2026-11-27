import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { currentRoom, refuse } from './current-room';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tempVoice.kick').addUserOption((opt) =>
    localize(opt, 'tempVoice.options.user').setRequired(true),
  ),
)
export class KickSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const current = await currentRoom(interaction);
    if (!current) return;
    const user = interaction.options.getUser('user', true);
    if (user.id === interaction.user.id || user.id === current.room.ownerId) {
      return refuse(interaction, 'tempVoice.replies.kickSelf');
    }
    await current.channel.permissionOverwrites.edit(user.id, { Connect: false });
    const member = current.channel.members.get(user.id);
    await member?.voice.disconnect('Kicked from temporary voice channel').catch(() => undefined);
    const content = tr('tempVoice.replies.kicked', { user: user.toString() });
    return interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

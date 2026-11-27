import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { TempVoiceService } from '../../temp-voice.service';
import { currentRoom, refuse } from './current-room';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tempVoice.transfer').addUserOption((opt) =>
    localize(opt, 'tempVoice.options.user').setRequired(true),
  ),
)
export class TransferSubcommand {
  private readonly tempVoice = inject(TempVoiceService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const current = await currentRoom(interaction);
    if (!current) return;
    const user = interaction.options.getUser('user', true);
    const member = current.channel.members.get(user.id);
    if (!member)
      return refuse(interaction, 'tempVoice.replies.notInChannel', { user: user.toString() });
    await this.tempVoice.setOwner(current.channel, current.room.ownerId, member);
    const content = tr('tempVoice.replies.transferred', { user: user.toString() });
    return interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

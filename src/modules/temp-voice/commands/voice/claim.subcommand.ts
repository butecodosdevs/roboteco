import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { TempVoiceService } from '../../temp-voice.service';
import { currentRoom, refuse } from './current-room';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'tempVoice.claim'))
export class ClaimSubcommand {
  private readonly tempVoice = inject(TempVoiceService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const current = await currentRoom(interaction, { ownerOnly: false });
    if (!current) return;
    if (
      current.channel.members.has(current.room.ownerId) &&
      current.room.ownerId !== interaction.user.id
    ) {
      return refuse(interaction, 'tempVoice.replies.ownerPresent');
    }
    await this.tempVoice.setOwner(current.channel, current.room.ownerId, interaction.member);
    const content = tr('tempVoice.replies.claimed');
    return interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { localize, t, translator } from '@/i18n';
import { currentRoom } from './current-room';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tempVoice.invite').addUserOption((opt) =>
    localize(opt, 'tempVoice.options.user').setRequired(true),
  ),
)
export class InviteSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const current = await currentRoom(interaction);
    if (!current) return;
    const user = interaction.options.getUser('user', true);
    await current.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, Connect: true });
    const dm = await user
      .send(
        t(interaction.guild.preferredLocale, 'tempVoice.invited', {
          owner: interaction.user.toString(),
          channel: current.channel.url,
        }),
      )
      .then(() => true)
      .catch(() => false);
    const content = tr(dm ? 'tempVoice.replies.invitedReply' : 'tempVoice.replies.invitedNoDm', {
      user: user.toString(),
      channel: current.channel.toString(),
    });
    return interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

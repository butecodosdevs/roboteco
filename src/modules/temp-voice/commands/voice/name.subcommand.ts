import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { currentRoom } from './current-room';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tempVoice.rename').addStringOption((opt) =>
    localize(opt, 'tempVoice.options.name').setRequired(true).setMaxLength(100),
  ),
)
export class NameSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const current = await currentRoom(interaction);
    if (!current) return;
    const name = interaction.options.getString('name', true);
    // Discord allows 2 renames per 10 minutes; discord.js waits out the limit instead of failing.
    const renamed = current.channel.setName(name).then(() => true);
    const done = await Promise.race([
      renamed,
      new Promise<false>((r) => setTimeout(() => r(false), 3000)),
    ]);
    renamed.catch(() => undefined);
    const content = tr(done ? 'tempVoice.replies.renamed' : 'tempVoice.replies.renameQueued', {
      name,
    });
    return interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

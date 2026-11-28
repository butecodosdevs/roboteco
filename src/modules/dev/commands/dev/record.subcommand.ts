import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { RecorderService } from '../../recorder.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'dev.record').addBooleanOption((o) =>
    localize(o, 'dev.options.on').setRequired(true),
  ),
)
export class RecordSubcommand {
  private readonly recorder = inject(RecorderService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    if (interaction.options.getBoolean('on', true)) {
      await this.recorder.start(interaction.client, interaction.guildId);
      return reply(tr('dev.replies.recordingOn'));
    }
    if (!this.recorder.recording) return reply(tr('dev.replies.notRecording'));
    return reply(tr('dev.replies.recordingOff', { count: this.recorder.stop() }));
  }
}

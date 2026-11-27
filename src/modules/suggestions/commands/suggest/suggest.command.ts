import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command, type GuildInteraction, inject } from '@/core';
import { getGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';
import { renderSuggestion } from '../../components/vote.button';
import { SuggestionsService } from '../../suggestions.service';

@Command({
  data: localize(new SlashCommandBuilder(), 'suggestions.suggest').addStringOption((opt) =>
    localize(opt, 'suggestions.options.content').setRequired(true).setMaxLength(2000),
  ),
  guildOnly: true,
  cooldown: 60,
})
export class SuggestCommand {
  private readonly suggestions = inject(SuggestionsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });

    const channelId = (await getGuildSettings(interaction.guildId))?.suggestionsChannelId;
    const channel = channelId
      ? await interaction.guild.channels.fetch(channelId).catch(() => null)
      : null;
    if (!channel?.isSendable()) return reply(tr('suggestions.replies.notConfigured'));

    const suggestion = await this.suggestions.create(
      interaction.guildId,
      interaction.user.id,
      interaction.options.getString('suggestion', true),
    );
    const view = await renderSuggestion(interaction.guild, suggestion, { up: 0, down: 0 });
    const message = await channel
      .send({ ...view, allowedMentions: { parse: [] } })
      .catch(() => null);
    if (!message) {
      await this.suggestions.remove(suggestion.id);
      return reply(tr('suggestions.replies.postFailed', { channel: channel.toString() }));
    }
    await this.suggestions.setMessage(suggestion.id, channel.id, message.id);
    return reply(tr('suggestions.replies.posted', { channel: channel.toString() }));
  }
}

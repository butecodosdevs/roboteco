import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand, schedule } from '@/core';
import { localize, translator } from '@/i18n';
import { parseDuration } from '@/lib/duration';
import { renderGiveaway } from '../../components/enter.button';
import { GiveawaysService } from '../../giveaways.service';
import { EndGiveawayJob } from '../../jobs/end-giveaway.job';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'giveaways.start')
    .addStringOption((opt) =>
      localize(opt, 'giveaways.options.prize').setRequired(true).setMaxLength(200),
    )
    .addStringOption((opt) =>
      localize(opt, 'giveaways.options.duration').setRequired(true).setMaxLength(20),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'giveaways.options.winners').setMinValue(1).setMaxValue(20),
    )
    .addChannelOption((opt) =>
      localize(opt, 'giveaways.options.channel').addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
      ),
    ),
)
export class StartSubcommand {
  private readonly giveaways = inject(GiveawaysService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    const seconds = parseDuration(interaction.options.getString('duration', true), {
      max: 60 * 86_400,
    });
    if (!seconds) return reply(tr('giveaways.replies.invalidDuration'));
    const channel =
      interaction.options.getChannel('channel', false, [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
      ]) ?? interaction.channel;
    if (!channel?.isSendable())
      return reply(tr('giveaways.replies.postFailed', { channel: String(channel) }));

    const giveaway = await this.giveaways.create({
      guildId: interaction.guildId,
      channelId: channel.id,
      hostId: interaction.user.id,
      prize: interaction.options.getString('prize', true),
      winnersCount: interaction.options.getInteger('winners') ?? 1,
      endsAt: new Date(Date.now() + seconds * 1000),
    });
    const message = await channel
      .send({ ...renderGiveaway(interaction.guild, giveaway, 0), allowedMentions: { parse: [] } })
      .catch(() => null);
    if (!message) {
      await this.giveaways.remove(giveaway.id);
      return reply(tr('giveaways.replies.postFailed', { channel: channel.toString() }));
    }
    const jobId = await schedule(EndGiveawayJob, giveaway.endsAt, { giveawayId: giveaway.id });
    await this.giveaways.update(giveaway.id, { messageId: message.id, jobId });
    return reply(tr('giveaways.replies.started', { id: giveaway.id, channel: channel.toString() }));
  }
}

import { Events, type Message } from 'discord.js';
import { inject, On, schedule } from '@/core';
import { DropsService, dropEmoji } from '../drops.service';
import { DrawDropJob, renderOpenDrop } from '../jobs/draw-drop.job';

@On(Events.MessageCreate)
export class MessageCreateEvent {
  private readonly drops = inject(DropsService);

  async execute(message: Message) {
    if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
    const config = await this.drops.countMessage(message.channelId, message.author.id);
    if (!config) return;

    const drawAt = new Date(Date.now() + config.lifetimeSeconds * 1000);
    const posted = await message.channel
      .send(renderOpenDrop(message.guild.preferredLocale, config, drawAt))
      .catch(() => null);
    if (!posted) return;
    await this.drops.open(
      posted.id,
      {
        guildId: message.guildId,
        channelId: message.channelId,
        xp: config.xp,
        winners: config.winners,
      },
      config.lifetimeSeconds,
    );
    await posted.react(dropEmoji).catch(() => undefined);
    await schedule(DrawDropJob, drawAt, { channelId: message.channelId, messageId: posted.id });
  }
}

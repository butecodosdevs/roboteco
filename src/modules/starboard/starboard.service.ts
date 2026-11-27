import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Message,
  type MessageCreateOptions,
} from 'discord.js';
import { eq } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, getGuildSettings, schema } from '@/db';
import { translator } from '@/i18n';
import { reportError } from '@/logger';

const entries = schema.starboardEntries;
export const starEmoji = '⭐';

@Injectable()
export class StarboardService {
  private readonly queues = new Map<string, Promise<void>>();

  sync(message: Message<true>, stars: number): Promise<void> {
    const previous = this.queues.get(message.id) ?? Promise.resolve();
    const next = previous
      .then(() => this.apply(message, stars))
      .catch((error) => {
        reportError(
          error,
          { message: message.id, guild: message.guildId },
          'Starboard update failed',
        );
      });
    this.queues.set(message.id, next);
    void next.finally(() => {
      if (this.queues.get(message.id) === next) this.queues.delete(message.id);
    });
    return next;
  }

  private async apply(message: Message<true>, stars: number): Promise<void> {
    const settings = await getGuildSettings(message.guildId);
    const channelId = settings?.starboardChannelId;
    if (!channelId || message.channelId === channelId || message.author.bot) return;
    const board = await message.guild.channels.fetch(channelId).catch(() => null);
    if (!board?.isTextBased() || !board.isSendable()) return;

    const [entry] = await db.select().from(entries).where(eq(entries.messageId, message.id));
    const threshold = settings.starboardThreshold;

    if (stars < threshold) {
      if (!entry) return;
      await board.messages.delete(entry.starboardMessageId).catch(() => undefined);
      await db.delete(entries).where(eq(entries.messageId, message.id));
      return;
    }

    const view = this.render(message, stars);
    if (entry) {
      const posted = await board.messages.fetch(entry.starboardMessageId).catch(() => null);
      if (posted) {
        await posted.edit(view);
        await db.update(entries).set({ stars }).where(eq(entries.messageId, message.id));
        return;
      }
    }
    const posted = await board.send({ ...view, allowedMentions: { parse: [] } });
    await db
      .insert(entries)
      .values({
        messageId: message.id,
        guildId: message.guildId,
        channelId: message.channelId,
        starboardMessageId: posted.id,
        stars,
      })
      .onConflictDoUpdate({
        target: entries.messageId,
        set: { starboardMessageId: posted.id, stars },
      });
  }

  private render(
    message: Message<true>,
    stars: number,
  ): Pick<MessageCreateOptions, 'content' | 'embeds' | 'components'> {
    const tr = translator(message.guild.preferredLocale);
    const image = message.attachments.find((a) => a.contentType?.startsWith('image/'));
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setTimestamp(message.createdAt);
    if (message.content) embed.setDescription(message.content.slice(0, 4096));
    if (image) embed.setImage(image.url);
    return {
      content: tr('starboard.post.header', { count: stars, channel: message.channel.toString() }),
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel(tr('starboard.post.jump'))
            .setURL(message.url),
        ),
      ],
    };
  }

  async purgeGuild(guildId: string): Promise<void> {
    await db.delete(entries).where(eq(entries.guildId, guildId));
  }
}

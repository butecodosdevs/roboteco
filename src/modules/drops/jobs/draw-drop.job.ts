import { type Client, EmbedBuilder, type MessageCreateOptions } from 'discord.js';
import { inject, Job } from '@/core';
import { t, translator } from '@/i18n';
import { relativeTime } from '@/lib/duration';
import { LevelsService } from '@/modules/levels/levels.service';
import { DropsService, dropEmoji } from '../drops.service';

export function renderOpenDrop(
  locale: string,
  drop: { xp: number; winners: number },
  drawAt: Date,
): Pick<MessageCreateOptions, 'embeds'> {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(t(locale, 'drops.drop.title'))
        .setDescription(
          t(locale, 'drops.drop.description', {
            emoji: dropEmoji,
            winners: drop.winners,
            xp: drop.xp,
            when: relativeTime(drawAt),
          }),
        ),
    ],
  };
}

export interface DrawDropPayload {
  channelId: string;
  messageId: string;
}

@Job('drops.draw')
export class DrawDropJob {
  async execute({ channelId, messageId }: DrawDropPayload, client: Client<true>) {
    const result = await inject(DropsService).draw(messageId);
    if (!result) return;
    const { drop, winnerIds, entrants } = result;
    const guild = client.guilds.cache.get(drop.guildId);
    if (!guild) return;

    const levels = inject(LevelsService);
    for (const userId of winnerIds) {
      const member = await guild.members.fetch(userId).catch(() => null);
      await levels.grant(member, drop.guildId, userId, drop.xp);
    }

    const tr = translator(guild.preferredLocale);
    const mentions = winnerIds.map((id) => `<@${id}>`).join(', ');
    const summary =
      winnerIds.length > 0
        ? tr('drops.drop.ended', { winners: mentions, xp: drop.xp, entrants })
        : tr('drops.drop.noEntries');
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) return;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    await message
      ?.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(0x95a5a6)
            .setTitle(tr('drops.drop.title'))
            .setDescription(summary),
        ],
      })
      .catch(() => undefined);
    if (winnerIds.length > 0) {
      await channel
        .send({
          content: tr('drops.drop.announce', { winners: mentions, xp: drop.xp }),
          allowedMentions: { users: winnerIds },
          ...(message && { reply: { messageReference: message.id, failIfNotExists: false } }),
        })
        .catch(() => undefined);
    }
  }
}

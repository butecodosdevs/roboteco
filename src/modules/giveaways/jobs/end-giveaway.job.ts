import type { Client, Guild } from 'discord.js';
import { inject, Job } from '@/core';
import { t } from '@/i18n';
import { renderGiveaway } from '../components/enter.button';
import { type Giveaway, GiveawaysService } from '../giveaways.service';

export async function finishGiveaway(
  guild: Guild,
  giveaway: Giveaway,
  reroll = false,
): Promise<void> {
  const giveaways = inject(GiveawaysService);
  const winnerIds = await giveaways.drawWinners(
    giveaway.id,
    giveaway.winnersCount,
    reroll ? giveaway.winnerIds : [],
  );
  const endedAt = giveaway.endedAt ?? new Date();
  await giveaways.update(giveaway.id, { winnerIds, endedAt, jobId: null });
  const finished = { ...giveaway, winnerIds, endedAt };

  const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel?.isTextBased() || !channel.isSendable()) return;
  if (giveaway.messageId) {
    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    await message
      ?.edit(renderGiveaway(guild, finished, await giveaways.entryCount(giveaway.id)))
      .catch(() => undefined);
  }
  const locale = guild.preferredLocale;
  await channel.send({
    content:
      winnerIds.length > 0
        ? t(locale, 'giveaways.announce', {
            winners: winnerIds.map((id) => `<@${id}>`).join(', '),
            prize: giveaway.prize,
          })
        : t(locale, 'giveaways.announceNone', { prize: giveaway.prize }),
    allowedMentions: { users: winnerIds },
  });
}

export interface EndGiveawayPayload {
  giveawayId: number;
}

@Job('giveaways.end')
export class EndGiveawayJob {
  async execute({ giveawayId }: EndGiveawayPayload, client: Client<true>) {
    const giveaway = await inject(GiveawaysService).getById(giveawayId);
    if (!giveaway || giveaway.endedAt) return;
    const guild = client.guilds.cache.get(giveaway.guildId);
    if (guild) await finishGiveaway(guild, giveaway);
  }
}

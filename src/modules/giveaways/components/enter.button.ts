import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Guild,
  type MessageCreateOptions,
  MessageFlags,
} from 'discord.js';
import { Button, customId, type GuildButtonInteraction, inject } from '@/core';
import { t, translator } from '@/i18n';
import { relativeTime } from '@/lib/duration';
import { type Giveaway, GiveawaysService } from '../giveaways.service';

export function renderGiveaway(
  guild: Guild,
  giveaway: Giveaway,
  entries: number,
): Pick<MessageCreateOptions, 'embeds' | 'components'> {
  const tr = translator(guild.preferredLocale);
  const ended = giveaway.endedAt !== null;
  const embed = new EmbedBuilder()
    .setColor(ended ? 0x95a5a6 : 0xe91e63)
    .setTitle(tr('giveaways.embed.title', { prize: giveaway.prize }))
    .setDescription(
      [
        ended
          ? tr('giveaways.embed.ended', { when: relativeTime(giveaway.endedAt ?? giveaway.endsAt) })
          : tr('giveaways.embed.running', { when: relativeTime(giveaway.endsAt) }),
        tr('giveaways.embed.host', { host: `<@${giveaway.hostId}>` }),
        tr('giveaways.embed.entries', { count: entries }),
      ].join('\n'),
    )
    .setFooter({
      text: tr('giveaways.embed.footer', { id: giveaway.id, winners: giveaway.winnersCount }),
    })
    .setTimestamp(giveaway.endsAt);
  if (ended) {
    embed.addFields({
      name: tr('giveaways.embed.winners'),
      value:
        giveaway.winnerIds.length > 0
          ? giveaway.winnerIds.map((id) => `<@${id}>`).join(', ')
          : tr('giveaways.embed.noWinners'),
    });
  }
  const button = new ButtonBuilder()
    .setCustomId(customId(EnterButton, giveaway.id))
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🎉')
    .setLabel(t(guild.preferredLocale, 'giveaways.embed.enter'))
    .setDisabled(ended);
  return {
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
  };
}

@Button('giveaways.enter')
export class EnterButton {
  private readonly giveaways = inject(GiveawaysService);

  async execute(interaction: GuildButtonInteraction, [id]: string[]) {
    const giveaway = await this.giveaways.get(interaction.guildId, Number(id));
    if (!giveaway || giveaway.endedAt) return interaction.deferUpdate();
    const entered = await this.giveaways.toggleEntry(giveaway.id, interaction.user.id);
    await interaction.update(
      renderGiveaway(interaction.guild, giveaway, await this.giveaways.entryCount(giveaway.id)),
    );
    return interaction.followUp({
      content: t(
        interaction.locale,
        entered ? 'giveaways.replies.entered' : 'giveaways.replies.left',
      ),
      flags: MessageFlags.Ephemeral,
    });
  }
}

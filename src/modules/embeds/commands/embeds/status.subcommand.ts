import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { getGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';
import { embedSites } from '../../embeds.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'embeds.status'))
export class StatusSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const settings = await getGuildSettings(interaction.guildId);
    const disabled = new Set(settings?.embedsDisabledSites ?? []);
    const ignored = settings?.embedsIgnoredChannels ?? [];

    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(tr('embeds.replies.statusTitle'));
    embed.addFields({
      name: tr('embeds.replies.statusState'),
      value: settings?.embedsEnabled
        ? tr('embeds.replies.statusOn')
        : tr('embeds.replies.statusOff'),
    });
    embed.addFields({
      name: tr('embeds.replies.statusSites'),
      value: embedSites
        .map((site) => `${disabled.has(site) ? '🔴' : '🟢'} ${tr(`embeds.sites.${site}`)}`)
        .join('\n'),
    });
    if (ignored.length > 0) {
      embed.addFields({
        name: tr('embeds.replies.statusIgnored'),
        value: ignored.map((id) => `<#${id}>`).join(' '),
      });
    }
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

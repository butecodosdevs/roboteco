import { EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { getGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';
import { embedSites } from '../../embeds.service';
import { refuseWithoutManageGuild } from './require-manage-guild';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'embeds.status'))
export class StatusSubcommand {
  async execute(interaction: GuildInteraction) {
    if (await refuseWithoutManageGuild(interaction)) return;
    const tr = translator(interaction.locale);
    const settings = await getGuildSettings(interaction.guildId);

    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(tr('embeds.replies.statusTitle'));
    embed.addFields({
      name: tr('embeds.replies.statusState'),
      value: settings?.embedsEnabled
        ? tr('embeds.replies.statusOn')
        : tr('embeds.replies.statusOff'),
    });
    embed.addFields({
      name: tr('embeds.replies.statusSites'),
      value: embedSites.map((site) => tr(`embeds.sites.${site}`)).join(', '),
    });
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { getGuildSettings, updateGuildSettings } from '@/db';
import { defaultLocale, localizations, localize, t, translator } from '@/i18n';
import { type EmbedSite, embedSites } from '../../embeds.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'embeds.site')
    .addStringOption((opt) =>
      localize(opt, 'embeds.options.site')
        .setRequired(true)
        .addChoices(
          ...embedSites.map((site) => ({
            name: t(defaultLocale, `embeds.sites.${site}`),
            name_localizations: localizations(`embeds.sites.${site}`),
            value: site,
          })),
        ),
    )
    .addBooleanOption((opt) => localize(opt, 'embeds.options.enabled').setRequired(true)),
)
export class SiteSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const site = interaction.options.getString('site', true) as EmbedSite;
    const enabled = interaction.options.getBoolean('enabled', true);

    const settings = await getGuildSettings(interaction.guildId);
    const disabled = new Set(settings?.embedsDisabledSites ?? []);
    if (enabled) disabled.delete(site);
    else disabled.add(site);

    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      embedsDisabledSites: [...disabled],
    });
    return interaction.reply({
      content: tr(enabled ? 'embeds.replies.siteEnabled' : 'embeds.replies.siteDisabled', {
        site: tr(`embeds.sites.${site}`),
      }),
      flags: MessageFlags.Ephemeral,
    });
  }
}

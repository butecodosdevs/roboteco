import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { config } from '@/config';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { getGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';
import { ClamavService } from '../../clamav.service';
import { PhishingListService } from '../../phishing-list.service';
import { ScanService } from '../../scan.service';
import { threatSources } from '../../threats.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'safety.status'))
export class StatusSubcommand {
  private readonly scanner = inject(ScanService);
  private readonly clamav = inject(ClamavService);
  private readonly phishingList = inject(PhishingListService);

  async execute(interaction: GuildInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const tr = translator(interaction.locale);
    const settings = await getGuildSettings(interaction.guildId);
    const configured = this.scanner.sources();
    const clamavUp = await this.clamav.isUp();

    const sources = threatSources.map((source) => {
      const name = tr(`safety.sources.${source}`);
      if (!configured.get(source)) return tr('safety.replies.sourceOff', { source: name });
      if (source === 'clamav' && !clamavUp)
        return tr('safety.replies.sourceDown', { source: name });
      if (source === 'phishingList') {
        return tr('safety.replies.sourceList', { source: name, count: this.phishingList.size });
      }
      return tr('safety.replies.sourceOn', { source: name });
    });

    const warnings = [
      config.privilegedIntents ? null : tr('safety.replies.noMessageContent'),
      interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageMessages)
        ? null
        : tr('safety.replies.noManageMessages'),
      settings?.moderationLogChannelId ? null : tr('safety.replies.noLogChannel'),
    ].filter((line) => line !== null);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(tr('safety.replies.statusTitle'))
      .addFields(
        {
          name: tr('safety.replies.statusState'),
          value: settings?.safetyEnabled
            ? tr('safety.replies.statusOn')
            : tr('safety.replies.statusOff'),
          inline: true,
        },
        {
          name: tr('safety.replies.statusTimeout'),
          value: settings?.safetyTimeoutMinutes
            ? tr('safety.replies.statusTimeoutMinutes', { minutes: settings.safetyTimeoutMinutes })
            : tr('safety.replies.statusTimeoutOff'),
          inline: true,
        },
        { name: tr('safety.replies.statusSources'), value: sources.join('\n') },
      );
    if (warnings.length > 0) {
      embed.addFields({ name: tr('safety.replies.statusWarnings'), value: warnings.join('\n') });
    }
    return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
}

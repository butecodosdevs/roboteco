import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { getGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';
import { logEvents } from '../../logs.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'logs.status'))
export class StatusSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const settings = await getGuildSettings(interaction.guildId);
    const disabled = new Set(settings?.serverLogDisabledEvents ?? []);
    const ignored = settings?.serverLogIgnoredChannels ?? [];

    const embed = new EmbedBuilder().setColor(0x3498db).setTitle(tr('logs.replies.statusTitle'));
    embed.addFields({
      name: tr('logs.replies.statusChannel'),
      value: settings?.serverLogChannelId
        ? `<#${settings.serverLogChannelId}>`
        : tr('logs.replies.statusNoChannel'),
    });
    embed.addFields({
      name: tr('logs.replies.statusEvents'),
      value: logEvents
        .map((event) => `${disabled.has(event) ? '🔴' : '🟢'} ${tr(`logs.events.${event}`)}`)
        .join('\n'),
    });
    const canReadAudit = interaction.guild.members.me?.permissions.has(
      PermissionFlagsBits.ViewAuditLog,
    );
    embed.addFields({
      name: tr('logs.replies.statusAuditLog'),
      value: tr(canReadAudit ? 'logs.replies.auditLogReadable' : 'logs.replies.auditLogMissing'),
    });
    if (ignored.length > 0) {
      embed.addFields({
        name: tr('logs.replies.statusIgnored'),
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

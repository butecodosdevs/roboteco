import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { getGuildSettings, updateGuildSettings } from '@/db';
import { defaultLocale, localizations, localize, t, translator } from '@/i18n';
import { type LogEvent, logEvents } from '@/modules/logs/logs.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'logs.toggle')
    .addStringOption((opt) =>
      localize(opt, 'logs.options.event')
        .setRequired(true)
        .addChoices(
          ...logEvents.map((event) => ({
            name: t(defaultLocale, `logs.events.${event}`),
            name_localizations: localizations(`logs.events.${event}`),
            value: event,
          })),
        ),
    )
    .addBooleanOption((opt) => localize(opt, 'logs.options.enabled').setRequired(true)),
)
export class ToggleSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const event = interaction.options.getString('event', true) as LogEvent;
    const enabled = interaction.options.getBoolean('enabled', true);

    const settings = await getGuildSettings(interaction.guildId);
    const disabled = new Set(settings?.serverLogDisabledEvents ?? []);
    if (enabled) disabled.delete(event);
    else disabled.add(event);

    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      serverLogDisabledEvents: [...disabled],
    });
    return interaction.reply({
      content: tr(enabled ? 'logs.replies.eventEnabled' : 'logs.replies.eventDisabled', {
        event: tr(`logs.events.${event}`),
      }),
      flags: MessageFlags.Ephemeral,
    });
  }
}

import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { getGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';
import { WelcomeService } from '../../welcome.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'welcome.test'))
export class TestSubcommand {
  private readonly welcome = inject(WelcomeService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const settings = await getGuildSettings(interaction.guildId);
    const channel = settings?.welcomeChannelId
      ? await interaction.guild.channels.fetch(settings.welcomeChannelId).catch(() => null)
      : null;
    if (!channel?.isSendable()) {
      return interaction.reply({
        content: tr('welcome.replies.notConfigured'),
        flags: MessageFlags.Ephemeral,
      });
    }
    await channel.send({
      content: this.welcome.render(interaction.member, settings?.welcomeMessage ?? null),
      allowedMentions: { users: [interaction.user.id] },
    });
    return interaction.reply({
      content: tr('welcome.replies.testSent', { channel: channel.toString() }),
      flags: MessageFlags.Ephemeral,
    });
  }
}

import { ChannelType, MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { getGuildSettings, updateGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';
import { renderPicker } from '../../components/roles.select';
import { RolesService } from '../../roles.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'roles.panel').addChannelOption((opt) =>
    localize(opt, 'roles.options.channel').addChannelTypes(ChannelType.GuildText).setRequired(true),
  ),
)
export class PanelSubcommand {
  private readonly roles = inject(RolesService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const { guild } = interaction;
    const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText]);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });

    const roles = await this.roles.list(guild.id);
    if (roles.length === 0) return reply(tr('roles.replies.noRoles'));

    const message = await channel.send(renderPicker(guild, roles)).catch(() => null);
    if (!message) return reply(tr('roles.replies.postFailed', { channel: channel.toString() }));

    const previous = await getGuildSettings(guild.id);
    if (previous?.rolePanelChannelId && previous.rolePanelMessageId) {
      const old = await guild.channels.fetch(previous.rolePanelChannelId).catch(() => null);
      if (old?.isTextBased())
        await old.messages.delete(previous.rolePanelMessageId).catch(() => undefined);
    }
    await updateGuildSettings(guild.id, guild.preferredLocale, {
      rolePanelChannelId: channel.id,
      rolePanelMessageId: message.id,
    });
    return reply(tr('roles.replies.panelPosted', { channel: channel.toString() }));
  }
}

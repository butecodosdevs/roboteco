import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { type GuildInteraction, Subcommand } from '@/core';
import { updateGuildSettings } from '@/db';
import { localize, translator } from '@/i18n';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'birthdays.setup')
    .addChannelOption((opt) =>
      localize(opt, 'birthdays.options.channel').addChannelTypes(ChannelType.GuildText),
    )
    .addRoleOption((opt) => localize(opt, 'birthdays.options.role')),
)
export class SetupSubcommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return reply(tr('birthdays.replies.notAllowed'));
    }
    const channel = interaction.options.getChannel('channel', false, [ChannelType.GuildText]);
    const role = interaction.options.getRole('role');
    const me = interaction.guild.members.me;
    if (role && (role.managed || !me || me.roles.highest.comparePositionTo(role) <= 0)) {
      return reply(tr('birthdays.replies.unassignable', { role: role.toString() }));
    }
    await updateGuildSettings(interaction.guildId, interaction.guild.preferredLocale, {
      birthdayChannelId: channel?.id ?? null,
      birthdayRoleId: role?.id ?? null,
    });
    return reply(
      channel
        ? tr('birthdays.replies.configured', { channel: channel.toString() })
        : tr('birthdays.replies.disabled'),
    );
  }
}

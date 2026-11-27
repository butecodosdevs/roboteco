import { MessageFlags } from 'discord.js';
import { Button, type GuildButtonInteraction } from '@/core';
import { getGuildSettings } from '@/db';
import { translator } from '@/i18n';
import { relativeTime } from '@/lib/duration';

@Button('verification.verify')
export class VerifyButton {
  async execute(interaction: GuildButtonInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    const { guild, member } = interaction;

    const settings = await getGuildSettings(guild.id);
    const role = settings?.verificationRoleId
      ? guild.roles.cache.get(settings.verificationRoleId)
      : undefined;
    if (!role) return reply(tr('verification.replies.notConfigured'));
    if (member.roles.cache.has(role.id)) return reply(tr('verification.replies.already'));

    const minAgeMs = (settings?.verificationMinAccountAgeDays ?? 0) * 86_400_000;
    const allowedAt = new Date(member.user.createdTimestamp + minAgeMs);
    if (allowedAt.getTime() > Date.now()) {
      return reply(tr('verification.replies.tooNew', { when: relativeTime(allowedAt) }));
    }

    await member.roles.add(role, 'Verified');
    return reply(tr('verification.replies.verified'));
  }
}

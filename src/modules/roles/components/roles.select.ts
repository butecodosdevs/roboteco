import {
  ActionRowBuilder,
  EmbedBuilder,
  type Guild,
  type MessageCreateOptions,
  MessageFlags,
  PermissionFlagsBits,
  type Role,
  StringSelectMenuBuilder,
} from 'discord.js';
import { customId, type GuildSelectInteraction, inject, SelectMenu } from '@/core';
import { getGuildSettings } from '@/db';
import { translator } from '@/i18n';
import { RolesService, type SelfRole } from '../roles.service';

export function renderPicker(
  guild: Guild,
  roles: SelfRole[],
): Pick<MessageCreateOptions, 'embeds' | 'components'> {
  const tr = translator(guild.preferredLocale);
  const available = roles.filter((r) => guild.roles.cache.has(r.roleId));
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(tr('roles.picker.title'))
    .setDescription(
      [
        tr('roles.picker.description'),
        '',
        ...available.map((r) =>
          r.description ? `<@&${r.roleId}> · ${r.description}` : `<@&${r.roleId}>`,
        ),
      ].join('\n'),
    );
  if (available.length === 0) return { embeds: [embed], components: [] };

  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId(RolesSelect))
    .setPlaceholder(tr('roles.picker.placeholder'))
    .setMinValues(0)
    .setMaxValues(available.length)
    .addOptions(
      available.map((r) => ({
        label: guild.roles.cache.get(r.roleId)?.name.slice(0, 100) ?? r.roleId,
        value: r.roleId,
        ...(r.description && { description: r.description.slice(0, 100) }),
      })),
    );
  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

export async function refreshPicker(guild: Guild, roles: SelfRole[]): Promise<void> {
  const settings = await getGuildSettings(guild.id);
  if (!settings?.rolePanelChannelId || !settings.rolePanelMessageId) return;
  const channel = await guild.channels.fetch(settings.rolePanelChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const message = await channel.messages.fetch(settings.rolePanelMessageId).catch(() => null);
  await message?.edit(renderPicker(guild, roles)).catch(() => undefined);
}

@SelectMenu('roles.pick')
export class RolesSelect {
  private readonly roles = inject(RolesService);

  async execute(interaction: GuildSelectInteraction) {
    const tr = translator(interaction.locale);
    const { guild, member } = interaction;
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: tr('roles.replies.botPermission'),
        flags: MessageFlags.Ephemeral,
      });
    }
    const offered = (await this.roles.list(guild.id))
      .map((r) => guild.roles.cache.get(r.roleId))
      .filter((role): role is Role => role !== undefined && this.roles.canHandOut(guild, role));
    const selected = new Set(interaction.values);

    const add = offered.filter((role) => selected.has(role.id) && !member.roles.cache.has(role.id));
    const remove = offered.filter(
      (role) => !selected.has(role.id) && member.roles.cache.has(role.id),
    );
    if (add.length > 0) await member.roles.add(add, 'Self-assigned role');
    if (remove.length > 0) await member.roles.remove(remove, 'Self-removed role');

    const list = (roles: typeof offered) =>
      roles.length > 0 ? roles.map((r) => r.toString()).join(', ') : tr('roles.replies.none');
    return interaction.reply({
      content:
        add.length + remove.length > 0
          ? tr('roles.replies.changes', { added: list(add), removed: list(remove) })
          : tr('roles.replies.nothing'),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

import {
  type CommandInteraction,
  MessageFlags,
  type Permissions,
  PermissionsBitField,
} from 'discord.js';
import { t } from '@/i18n';

/**
 * A command's default member permissions are only a default: a server admin can open it to anyone
 * in Server Settings > Integrations. The framework checks them again before any handler runs.
 */
export function lacksDefaultPermissions(
  required: Permissions | null | undefined,
  member: Readonly<PermissionsBitField> | null,
): bigint | null {
  if (required === null || required === undefined) return null;
  const bits = BigInt(required);
  if (member?.has(bits)) return null;
  return member ? new PermissionsBitField(bits).remove(member).bitfield : bits;
}

export function refuseMissing(interaction: CommandInteraction, missing: bigint): Promise<unknown> {
  return interaction.reply({
    content: t(interaction.locale, 'errors.missingPermission', {
      permissions: new PermissionsBitField(missing).toArray().join(', '),
    }),
    flags: MessageFlags.Ephemeral,
  });
}

import { type CommandInteraction, MessageFlags } from 'discord.js';
import { t } from '@/i18n';

const sweepEvery = 1000;

export class Cooldowns {
  private readonly until = new Map<string, number>();
  private checks = 0;

  remaining(key: string, seconds: number): number {
    if (seconds <= 0) return 0;
    const now = Date.now();
    if (++this.checks % sweepEvery === 0) {
      for (const [k, expires] of this.until) if (expires <= now) this.until.delete(k);
    }
    const expires = this.until.get(key) ?? 0;
    if (expires > now) return expires - now;
    this.until.set(key, now + seconds * 1000);
    return 0;
  }
}

export function replyCooldown(interaction: CommandInteraction, remainingMs: number) {
  const when = `<t:${Math.ceil((Date.now() + remainingMs) / 1000)}:R>`;
  return interaction.reply({
    content: t(interaction.locale, 'errors.cooldown', { when }),
    flags: MessageFlags.Ephemeral,
  });
}

import { spawn } from 'node:child_process';
import { z } from 'zod';
import { config } from '@/config';
import { Injectable, inject, registerPanelRoute } from '@/core';
import { readSettings, settingsKeys, writeSettings } from '@/core/settings';

export interface SettingField {
  /** The panel translates each key; the server only reports state. */
  key: string;
  restart: boolean;
  secret: boolean;
  /** Masked for secrets, `null` when unset. */
  value: string | null;
  /** True when the running process already uses this value. */
  active: boolean;
}

const defaults: Record<string, string> = { LOG_LEVEL: 'info', GUILD_DATA_RETENTION_DAYS: '30' };

/** What the running process parsed, so the panel can show "salvo" versus "ativo". */
function running(key: string): string | null {
  switch (key) {
    case 'DISCORD_TOKEN':
      return config.token;
    case 'DISCORD_CLIENT_ID':
      return config.clientId;
    case 'DISCORD_GUILD_ID':
      return config.guildId ?? null;
    case 'LOG_LEVEL':
      return config.logLevel;
    case 'GUILD_DATA_RETENTION_DAYS':
      return String(config.guildDataRetentionDays);
    case 'SENTRY_DSN':
      return config.sentryDsn ?? null;
    default:
      return null;
  }
}

/** `abcd…wxyz`: enough to recognise a token without printing it. */
const redact = (value: string) =>
  value.length <= 12 ? '••••••••' : `${value.slice(0, 4)}…${value.slice(-4)}`;

@Injectable()
export class PanelSettingsService {
  list(): SettingField[] {
    const file = readSettings();
    return settingsKeys.map((item) => {
      const stored = file[item.key] ?? process.env[item.key] ?? defaults[item.key] ?? null;
      const active = running(item.key);
      return {
        key: item.key,
        restart: item.restart,
        secret: item.secret ?? false,
        value: stored && item.secret ? redact(stored) : stored,
        active: active !== null && active === stored,
      };
    });
  }

  save(input: Record<string, string>): SettingField[] {
    writeSettings(input);
    return this.list();
  }

  /**
   * A new token cannot be hot-swapped: the gateway, REST client and every module hold the old one.
   * Restarting the container is the honest way, so this only works where that is set up.
   */
  restart(): { restarted: boolean } {
    if (process.env.ROBOTECO_RESTART !== 'docker') return { restarted: false };
    spawn('sh', ['-c', 'kill -TERM 1'], { detached: true, stdio: 'ignore' }).unref();
    return { restarted: true };
  }
}

const saveSchema = z.record(z.string(), z.string());

export function registerPanelSettings(): void {
  const settings = inject(PanelSettingsService);

  registerPanelRoute('settings', async ({ method, body }) => {
    if (method === 'GET') return { body: { fields: settings.list() } };
    if (method === 'PUT' || method === 'PATCH') {
      return { body: { fields: settings.save(saveSchema.parse(body ?? {})) } };
    }
    if (method === 'POST') {
      z.object({ action: z.literal('restart') }).parse(body ?? {});
      return { body: settings.restart() };
    }
    return { status: 405, body: { error: `settings: ${method} não suportado` } };
  });
}

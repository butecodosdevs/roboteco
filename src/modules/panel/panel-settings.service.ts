import { spawn } from 'node:child_process';
import { z } from 'zod';
import { config } from '@/config';
import { Injectable } from '@/core';
import { liveSetting, readSettings, settingsKeys, writeSettings } from '@/core/settings';
import type { PanelRouterService } from './panel-router.service';

export interface SettingField {
  /** The panel translates each key; the server only reports state. */
  key: string;
  restart: boolean;
  secret: boolean;
  /** False for keys the panel may show but never save (the bot token, the Sentry DSN). */
  writable: boolean;
  /** Masked for secrets, `null` when unset. */
  value: string | null;
  /** True when the running process already uses this value. */
  active: boolean;
}

const defaults: Record<string, string> = { LOG_LEVEL: 'info', GUILD_DATA_RETENTION_DAYS: '30' };

/** A save that names a read-only key, answered as 400 instead of a silent partial write. */
export class BadSettingKey extends Error {}

/** What the running process parsed, so the panel can tell "saved" from "in effect". */
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
    case 'PANEL_ALLOWED_EMAILS':
      return liveSetting('PANEL_ALLOWED_EMAILS');
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
    // The allowlist has its own card (it applies without a restart); listing it twice invites edits
    // in two places with different behaviour.
    return settingsKeys
      .filter((item) => item.key !== 'PANEL_ALLOWED_EMAILS')
      .map((item) => {
        const stored = file[item.key] ?? process.env[item.key] ?? defaults[item.key] ?? null;
        const active = running(item.key);
        return {
          key: item.key,
          restart: item.restart,
          secret: item.secret ?? false,
          writable: item.writable,
          value: stored && item.secret ? redact(stored) : stored,
          active: active !== null && active === stored,
        };
      });
  }

  /**
   * Refuses a read-only key instead of dropping it silently: a 200 that ignored half the body
   * would look like the value was saved.
   */
  save(input: Record<string, string>): SettingField[] {
    const readOnly = Object.keys(input).filter(
      (key) => settingsKeys.find((item) => item.key === key && !item.writable) !== undefined,
    );
    if (readOnly.length > 0) {
      throw new BadSettingKey(`read_only_setting: ${readOnly.join(', ')}`);
    }
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

/** Mounts `PUT /api/panel/settings` and friends. Called once, by PanelModule. */
export function registerPanelSettings(
  settings: PanelSettingsService,
  router: PanelRouterService,
): void {
  router.route('settings', async ({ method, body }) => {
    if (method === 'GET') return { body: { fields: settings.list() } };
    if (method === 'PUT' || method === 'PATCH') {
      try {
        return { body: { fields: settings.save(saveSchema.parse(body ?? {})) } };
      } catch (error) {
        if (error instanceof BadSettingKey) return { status: 400, body: { error: error.message } };
        throw error;
      }
    }
    if (method === 'POST') {
      z.object({ action: z.literal('restart') }).parse(body ?? {});
      return { body: settings.restart() };
    }
    return { status: 405, body: { error: 'method_not_allowed' } };
  });
}

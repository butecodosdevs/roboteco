import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Settings the panel can change without a redeploy. They live in `panel/settings.json` and are
 * applied to `process.env` before `config` is parsed, so the same file works under Docker as long
 * as the directory is on a volume.
 */
export interface SettingsKey {
  key: string;
  secret?: boolean;
  /** Read once at boot: changing it needs a restart to take effect. */
  restart: boolean;
  /**
   * Writable from the panel. Everything else is shown but not saved: a panel session must not be
   * able to replace the bot token or the Sentry DSN, which is the same power as taking over the bot
   * and exfiltrating every server's data to an attacker-controlled endpoint.
   */
  writable: boolean;
}

export const settingsKeys: SettingsKey[] = [
  // Read-only on purpose. Setting either one from a web session is a privilege escalation: the
  // token is the bot, and the DSN ships logs (with user IDs) to a collector the session picks.
  { key: 'DISCORD_TOKEN', secret: true, restart: true, writable: false },
  { key: 'DISCORD_CLIENT_ID', restart: true, writable: false },
  { key: 'DISCORD_GUILD_ID', restart: true, writable: false },
  { key: 'SENTRY_DSN', secret: true, restart: true, writable: false },
  // Operational knobs: changing them cannot hand anyone the bot, only tune how it behaves.
  { key: 'LOG_LEVEL', restart: true, writable: true },
  { key: 'GUILD_DATA_RETENTION_DAYS', restart: true, writable: true },
  // No restart: the allowlist is read live, so removing an email revokes its session at once.
  { key: 'PANEL_ALLOWED_EMAILS', restart: false, writable: true },
];

// Overridable so tests write to a throwaway file instead of the real settings.
export const settingsPath = process.env.ROBOTECO_SETTINGS_PATH ?? resolve('panel/settings.json');

export function readSettings(): Record<string, string> {
  const raw = readSafely();
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const item of settingsKeys) {
      const value = (parsed as Record<string, unknown>)[item.key];
      if (typeof value === 'string' && value !== '') out[item.key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function readSafely(): string {
  try {
    return readFileSync(settingsPath, 'utf8');
  } catch {
    return '';
  }
}

/** Written with `0600` because it holds the bot token. */
export function writeSettings(next: Record<string, string>): void {
  const merged = { ...readSettings() };
  for (const item of settingsKeys) {
    // A read-only key is refused here, at the single write path, so no route can bypass it by
    // calling `writeSettings` directly.
    if (!item.writable) continue;
    const value = next[item.key];
    if (value === undefined) continue;
    if (value === '') delete merged[item.key];
    else merged[item.key] = value;
  }
  mkdirSync(dirname(settingsPath), { recursive: true });
  const temporary = `${settingsPath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(merged, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, settingsPath);
}

/**
 * Read from the file on every call instead of caching in `config`: the allowlist has to change the
 * moment someone saves it, without a restart, or removing an email would leave them in for a day.
 */
export function liveSetting(key: string): string | null {
  const file = readSettings();
  if (file[key] !== undefined) return file[key];
  const env = process.env[key];
  return env === undefined || env === '' ? null : env;
}

/** Called before anything imports `config`, so overrides win over the real environment. */
export function applySettingsToEnv(): void {
  const settings = readSettings();
  for (const [key, value] of Object.entries(settings)) process.env[key] = value;
}

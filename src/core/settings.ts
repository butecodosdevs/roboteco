import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Settings the panel can change without a redeploy. They live in `panel/settings.json` and are
 * applied to `process.env` before `config` is parsed, so the same file works under Docker as long
 * as the directory is on a volume.
 */
export interface SettingsKey {
  key: string;
  label: string;
  hint: string;
  secret?: boolean;
  /** Read once at boot: changing it needs a restart to take effect. */
  restart: boolean;
}

export const settingsKeys: SettingsKey[] = [
  {
    key: 'DISCORD_TOKEN',
    label: 'Token do bot',
    hint: 'Developer Portal → Bot → Reset Token. O bot cai e volta com o token novo.',
    secret: true,
    restart: true,
  },
  {
    key: 'DISCORD_CLIENT_ID',
    label: 'Application ID',
    hint: 'Developer Portal → General Information. Usado para publicar comandos.',
    restart: true,
  },
  {
    key: 'DISCORD_GUILD_ID',
    label: 'Servidor de testes',
    hint: 'Com um ID aqui os comandos vão só para esse servidor, na hora. Vazio publica global.',
    restart: true,
  },
  {
    key: 'LOG_LEVEL',
    label: 'Nível de log',
    hint: 'fatal, error, warn, info, debug ou trace.',
    restart: true,
  },
  {
    key: 'GUILD_DATA_RETENTION_DAYS',
    label: 'Retenção de dados',
    hint: 'Dias que os dados de um servidor ficam guardados depois que o bot sai.',
    restart: true,
  },
  {
    key: 'SENTRY_DSN',
    label: 'Sentry DSN',
    hint: 'Vazio desliga o envio de erros.',
    secret: true,
    restart: true,
  },
];

export const settingsPath = resolve('panel/settings.json');

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

/** Called before anything imports `config`, so overrides win over the real environment. */
export function applySettingsToEnv(): void {
  const settings = readSettings();
  for (const [key, value] of Object.entries(settings)) process.env[key] = value;
}

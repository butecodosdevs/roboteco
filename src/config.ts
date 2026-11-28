import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((v) => v || undefined);

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: 'DATABASE_URL must be a postgres:// URL',
  }),
  S3_ENDPOINT: z.url(),
  VALKEY_URL: z
    .url({ protocol: /^rediss?$/, error: 'VALKEY_URL must be a redis:// or rediss:// URL' })
    .default('redis://localhost:6379'),
  S3_REGION: z.string().default('garage'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  DISCORD_PRIVILEGED_INTENTS: z.stringbool().default(false),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SENTRY_DSN: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  HEALTH_PORT: z.coerce.number().int().positive().optional(),
  GUILD_DATA_RETENTION_DAYS: z.coerce.number().int().min(0).default(30),
  PLUGIN_REGISTRY: z.string().min(1).default('plugins/registry.json'),
  DISCORD_GUILD_ID: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  PHISHING_LIST_URLS: z
    .string()
    .default('https://raw.githubusercontent.com/Discord-AntiScam/scam-links/main/list.txt')
    .transform((v) =>
      v
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url())),
  CLAMAV_HOST: optionalString,
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  SAFE_BROWSING_API_KEY: optionalString,
  ABUSECH_AUTH_KEY: optionalString,
  VIRUSTOTAL_API_KEY: optionalString,
  VIRUSTOTAL_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).default(4),
  VIRUSTOTAL_REQUESTS_PER_DAY: z.coerce.number().int().min(1).default(500),
  VIRUSTOTAL_MIN_DETECTIONS: z.coerce.number().int().min(1).default(3),
  SAFETY_MAX_FILE_MB: z.coerce.number().positive().default(25),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = {
  token: parsed.data.DISCORD_TOKEN,
  clientId: parsed.data.DISCORD_CLIENT_ID,
  guildId: parsed.data.DISCORD_GUILD_ID,
  privilegedIntents: parsed.data.DISCORD_PRIVILEGED_INTENTS,
  env: parsed.data.NODE_ENV,
  logLevel: parsed.data.LOG_LEVEL,
  sentryDsn: parsed.data.SENTRY_DSN,
  healthPort: parsed.data.HEALTH_PORT,
  guildDataRetentionDays: parsed.data.GUILD_DATA_RETENTION_DAYS,
  pluginRegistry: parsed.data.PLUGIN_REGISTRY,
  databaseUrl: parsed.data.DATABASE_URL,
  valkeyUrl: parsed.data.VALKEY_URL,
  s3: {
    endpoint: parsed.data.S3_ENDPOINT,
    region: parsed.data.S3_REGION,
    accessKeyId: parsed.data.S3_ACCESS_KEY_ID,
    secretAccessKey: parsed.data.S3_SECRET_ACCESS_KEY,
    bucket: parsed.data.S3_BUCKET,
  },
  safety: {
    phishingListUrls: parsed.data.PHISHING_LIST_URLS,
    clamav: parsed.data.CLAMAV_HOST
      ? { host: parsed.data.CLAMAV_HOST, port: parsed.data.CLAMAV_PORT }
      : undefined,
    safeBrowsingApiKey: parsed.data.SAFE_BROWSING_API_KEY,
    abuseChAuthKey: parsed.data.ABUSECH_AUTH_KEY,
    virusTotal: parsed.data.VIRUSTOTAL_API_KEY
      ? {
          apiKey: parsed.data.VIRUSTOTAL_API_KEY,
          perMinute: parsed.data.VIRUSTOTAL_REQUESTS_PER_MINUTE,
          perDay: parsed.data.VIRUSTOTAL_REQUESTS_PER_DAY,
          minDetections: parsed.data.VIRUSTOTAL_MIN_DETECTIONS,
        }
      : undefined,
    maxFileBytes: Math.floor(parsed.data.SAFETY_MAX_FILE_MB * 1024 * 1024),
  },
};

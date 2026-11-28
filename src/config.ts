import { z } from 'zod';

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
};

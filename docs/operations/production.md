# Running in production

## What it is

`compose.prod.yaml` runs the whole bot from one Docker image (`Dockerfile`), next to PostgreSQL, Garage, Valkey and a backup job:

| Service | Runs | Lifetime |
| --- | --- | --- |
| `postgres`, `garage`, `valkey` | Database, file storage and cache. No host ports, so only the other containers can reach them. Valkey keeps nothing on disk and evicts expiring keys past 256 MB | always |
| `migrate` | `node dist/db/migrate.js`, applying the migrations in `drizzle/` | once per `up`, before the bot starts |
| `deploy-commands` | `node dist/deploy-commands.js`, uploading slash commands and right-click menus | once per `up`, after migrations |
| `bot` | `node dist/index.js`. Health checks on port 3000 are published on the host, so they're reachable over Tailscale | always, restarted on crash |
| `backup` | `pg_dump` into `./backups/` on a schedule | always |

## What it's for

One command builds, migrates, registers commands and (re)starts the bot, with the data kept safe. A failed migration stops the release before the new bot starts.

## How it works

### First deploy

1. On the server, check out the repository and create `.env` with:
   - the Discord variables from [getting started](../getting-started.md#environment);
   - `POSTGRES_PASSWORD` and `GARAGE_RPC_SECRET`. Generate both with `openssl rand -hex 32`; hex keeps the password safe inside a database URL;
   - `S3_ACCESS_KEY_ID=GK$(openssl rand -hex 12)`, `S3_SECRET_ACCESS_KEY=$(openssl rand -hex 32)` and `S3_BUCKET=roboteco`;
   - optionally `SENTRY_DSN`, `LOG_LEVEL`, `DISCORD_PRIVILEGED_INTENTS=true`, `GUILD_DATA_RETENTION_DAYS`, `BACKUP_INTERVAL_HOURS` and `BACKUP_RETENTION_DAYS`.

   `DATABASE_URL` and `S3_ENDPOINT` are set by the compose file, so local values in `.env` don't leak in.
2. Start storage once and prepare it:

   ```sh
   docker compose -f compose.prod.yaml up -d garage
   COMPOSE_FILE=compose.prod.yaml pnpm storage:init
   ```
3. Start everything: `pnpm prod:up`, which runs `docker compose -f compose.prod.yaml up -d --build`.

### Releases

`git pull && pnpm prod:up`. Compose rebuilds the image, runs `migrate`, then `deploy-commands`, then replaces `bot`. Set `ROBOTECO_VERSION` to tag images, for example the git SHA, so you can roll back to an earlier one.

Migrations must stay backwards-compatible for one release. The old bot keeps running until the new one starts, so add columns first and remove old ones in a later release.

### Logs and errors

- **Logs** are JSON lines from [pino](https://getpino.io) (`src/logger.ts`). Follow them with `pnpm prod:logs`. In development they're printed human-readable. `LOG_LEVEL` defaults to `info`.
- **Errors** go through `reportError(error, context, message)`, which logs them and, when `SENTRY_DSN` is set, sends them to Sentry. Every failed interaction, event, job and `onReady` is reported this way, as are unhandled rejections and Discord client errors.
- An uncaught exception is reported, then the process exits so Docker restarts it.

### Health

`GET /health` on `HEALTH_PORT` returns `200 {"status":"ok"}` once the bot is connected to Discord, and `503` before that. The Docker health check uses it. Point an uptime monitor at `http://<host>:3000/health`; `HEALTH_PUBLISH_PORT` changes the published port.

### Backups

`backup` writes `backups/roboteco-<UTC timestamp>.dump` every `BACKUP_INTERVAL_HOURS` (default 24) and deletes dumps older than `BACKUP_RETENTION_DAYS` (default 14). A dump is first written as `.partial` and renamed when complete, so a crash never leaves a half-written file that looks valid. Copy `backups/` off the machine (rsync, restic, …), because a backup on the same disk doesn't survive that disk failing.

Restore:

```sh
docker compose -f compose.prod.yaml stop bot
docker compose -f compose.prod.yaml exec -T postgres \
  pg_restore --clean --if-exists -U roboteco -d roboteco < backups/roboteco-20261127T000000Z.dump
docker compose -f compose.prod.yaml start bot
```

Garage data (uploaded files) lives in the `garage-data` volume. Back that up with a volume snapshot if you store files you can't lose.

### Data lifecycle

- When the bot is removed from a server, `GuildsService` schedules a purge after `GUILD_DATA_RETENTION_DAYS` (default 30). Re-adding the bot within that time cancels it.
- When the purge runs, every module's `onGuildRemove` deletes its rows, then the `guilds` row goes.
- Members can delete their own data with `/privacy delete`. Staff can delete a member's data in their server with `/privacy forget`. Both call every module's `onUserErase`. Moderation cases are kept as server records. See [the privacy example](../examples/privacy.md).

### Plugins

No plugins are installed in releases: the image ships the empty `plugins/registry.json`, and the plugins in `plugins/` are examples. Installing one in production means adding it to the registry and building its WASM into the image (see [plugins](../concepts/plugins.md)).

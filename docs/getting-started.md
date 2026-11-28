# Getting started

## Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| [mise](https://mise.jdx.dev) | latest | `mise install` installs the Node, pnpm, Rust and Go pinned in `mise.toml` |
| [Node.js](https://nodejs.org) | 26.10.0 (min. 22.12) | Runtime |
| [pnpm](https://pnpm.io) | 12.5.1 | Package manager |
| [Docker](https://docs.docker.com/get-docker/) + Compose | Compose v2+ | Runs PostgreSQL, Garage and Valkey locally |
| [Rust](https://rustup.rs) | stable | Builds the [plugins](concepts/plugins.md) and the Rust test fixtures with `pnpm plugins:build`, which `pnpm test` needs. `rust-toolchain.toml` adds the `wasm32-unknown-unknown` target on the first build |
| [Go](https://go.dev) | 1.27 (min. 1.24) | Builds the Go test fixture in `pnpm plugins:build`, and Go plugins |

## Discord application

1. Create an application in the [Developer Portal](https://discord.com/developers/applications) and add a bot. Copy the bot token and the application ID.
2. Invite the bot: OAuth2 → URL Generator → scopes `bot` + `applications.commands`, permissions **View Channels**, **Send Messages**, **Send Messages in Threads**, **Embed Links**, **Read Message History**, **Manage Messages**, **Manage Webhooks** (link previews), **Add Reactions**, **Manage Roles**, **Manage Channels**, **Move Members**, **Mute Members**, **Deafen Members**, **Manage Server** (lockdowns, invite tracking, AutoMod), **View Audit Log** (who did each action in the server log), **Create Private Threads**, **Manage Threads**, **Kick Members**, **Ban Members** and **Moderate Members** (the permission that allows timeouts).
3. Put the bot's role above every role it should assign, and above the members it should moderate.
4. For `welcome`, `logs`, `antiraid`, `invites` and `counting`, enable **Server Members Intent** and **Message Content Intent** under Bot → Privileged Gateway Intents, and set `DISCORD_PRIVILEGED_INTENTS=true`. Without that variable the bot starts without them and logs which modules are affected.

## Environment

Copy `.env.example` to `.env`. `src/config.ts` validates these at startup:

| Variable | Required | Local value |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | bot token |
| `DISCORD_CLIENT_ID` | yes | application ID |
| `DISCORD_PRIVILEGED_INTENTS` | no | `true` once the privileged intents are enabled in the portal (default `false`) |
| `NODE_ENV` | no | `development` (default; readable logs), `production` (JSON logs) or `test` |
| `LOG_LEVEL` | no | `info` (default); `debug` for more |
| `SENTRY_DSN` | no | error reporting, off when empty |
| `HEALTH_PORT` | no | serves `GET /health` when set |
| `GUILD_DATA_RETENTION_DAYS` | no | days to keep a server's data after the bot leaves (default 30) |
| `PLUGIN_REGISTRY` | no | plugin registry to load (default `plugins/registry.json`, empty; `plugins/registry.example.json` loads the `hello-rust` example) |
| `DISCORD_GUILD_ID` | no | your test server ID. When set, `deploy-commands` registers commands on that server instantly instead of globally |
| `DATABASE_URL` | yes | `postgres://roboteco:roboteco@localhost:5432/roboteco` |
| `VALKEY_URL` | no | `redis://localhost:6379` (default) |
| `S3_ENDPOINT` | yes | `http://localhost:3900` |
| `S3_REGION` | no | `garage` (default) |
| `S3_ACCESS_KEY_ID` | yes | `GKe0eaf809415eba6c4491e65b` |
| `S3_SECRET_ACCESS_KEY` | yes | `f35c5ac8cf98fe2bcf4605b8b776d1635f2e5b7e9adf815424e291efcde6b3be` |
| `S3_BUCKET` | yes | `roboteco` |

`compose.yaml` also reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `GARAGE_S3_PORT`, `VALKEY_PORT` and `GARAGE_RPC_SECRET`. The S3 keys and RPC secret above are development defaults; use your own values anywhere else.

## First run

```sh
mise install
pnpm install
pnpm plugins:build     # WASM plugins and test fixtures; needed by pnpm test
pnpm services:up       # PostgreSQL + Garage + Valkey
pnpm storage:init      # Garage layout, key and bucket (safe to rerun)
pnpm db:migrate
pnpm deploy-commands
pnpm dev
```

For production, see [running in production](operations/production.md).

## Testing events by hand

With `NODE_ENV=development` (the default), the bot also loads `/dev`, which is never deployed in production. It fires a fake gateway event built from real objects in your server. Every listener handles it as if Discord had sent it, but nothing actually changes on Discord.

- `/dev message`: edit, delete or bulk delete the latest messages in `channel` (default: here), optionally only those by `author`.
- `/dev member`: join, leave, kick, nickname, role (`role`), timeout, boost, ban or unban for `member` (default: you).
- `/dev channel` and `/dev role`: create, update or delete `channel` (default: here) or `role`.
- `/dev voice`: join, leave, disconnect, move, server mute or deafen `member` in a voice `channel` (default: where the member is).

Add `actor` (and `reason`) to pretend the audit log credits that user, so you can see "By" lines without a second account. Discord writes no audit entry for some events, such as message edits, joins and boosts. For those, and for any other option a scenario doesn't use, the reply says what was ignored. Fake joins, leaves and channel deletes reach every listener, so the reply also lists what else they touched.

Two more are for the [plugin](concepts/plugins.md#recorded-discord-payloads) tests:
- `/dev record on:True`: save one anonymized example of each Discord event and `/dev fidelity` interaction into `tests/fixtures/discord`, until `on:False`.
- `/dev fidelity`: every option type, plus a panel with a button, a form and each kind of select. The **Fidelity user** and **Fidelity message** menus go with it.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Run with reload on change |
| `pnpm build` / `pnpm start` | Bundle to `dist/` with esbuild and run it (with source maps) |
| `pnpm deploy-commands` | Register slash commands with Discord. Run after changing command names, descriptions or options |
| `pnpm typecheck` | TypeScript, including `scripts/` and `tests/` |
| `pnpm test` | Behaviour tests in `tests/`, against the Postgres and Valkey in `.env` (run `pnpm db:migrate` first) |
| `pnpm lint` | Biome plus [structure rules](concepts/structure-rules.md) |
| `pnpm lint:structure` | Structure rules only |
| `pnpm format` | Format and apply safe Biome fixes |
| `pnpm services:up` / `services:down` | Start / stop the Docker services |
| `pnpm storage:init` | Prepare Garage for S3 requests |
| `pnpm db:generate` / `db:migrate` | Create / apply migrations |
| `pnpm db:migrate:runtime` | Apply migrations the way production does (no drizzle-kit) |
| `pnpm prod:up` / `prod:logs` | Build and start `compose.prod.yaml` / follow the bot's logs |
| `pnpm plugins:build` | Build the example WASM plugin and the test fixtures into `plugins/dist/` |
| `pnpm plugin check\|run\|click\|submit\|event\|job\|schema` | Validate a plugin; run its commands, buttons, forms, events and jobs without Discord; export the contract's JSON Schema ([plugins](concepts/plugins.md#quick-start)) |
| `pnpm db:push` / `db:studio` | Sync the schema without a migration (local only) / browse data |

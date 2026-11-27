# AGENTS.md

roboteco is a Discord bot for a community, written in TypeScript with discord.js v14, PostgreSQL (Drizzle), Valkey (cache) and S3 storage (Garage). It uses an Angular-style module system built on decorators, and runs community plugins as sandboxed WASM ([plugins](docs/concepts/plugins.md)).

Read [docs/README.md](docs/README.md) first. Each concept doc explains what the piece is, what it is for and how it works, then gives a complete example to copy. [docs/examples/honeypot.md](docs/examples/honeypot.md) shows a real feature built from all of them.

## Before you change code

- Find your task in [docs/README.md](docs/README.md#how-do-i) and follow the linked example.
- New behaviour goes in a feature module under `src/modules/<feature>/` ([architecture](docs/architecture.md)). Don't add code to `src/core/` unless you are changing the framework itself.
- Follow the naming and placement rules in [docs/concepts/structure-rules.md](docs/concepts/structure-rules.md). `pnpm lint` enforces them.

## Rules

- All user-facing text goes through i18n, with entries in **every** locale (`en-US` and `pt-BR`). See [i18n](docs/concepts/i18n.md).
- `name` keys in `en-US` are the command and option identifiers that handlers match on. Changing one is a breaking change.
- Change the database only through `src/db/schema.ts` + `pnpm db:generate`. Commit the generated migration and never edit one that is already committed. See [database](docs/concepts/database.md).
- Use `inject(Service)` for shared state. Never use module-level mutable state.
- Components and staff-only buttons must check permissions themselves. Messages the bot posts on behalf of a member use `allowedMentions: { parse: [] }`.
- Time-based work goes through `schedule()` and a `@Job`, never `setTimeout`.
- Use Valkey (`@/cache`) for counters, cooldowns and expiring state, with atomic commands and a TTL. Use Postgres for anything that must last ([cache](docs/concepts/cache.md)).
- Log with `logger` and report failures with `reportError` (`src/logger.ts`). Never use `console`.
- A new table with server or user data needs `onGuildRemove` / `onUserErase` on its module ([privacy](docs/examples/privacy.md#module-hooks)).
- Write per-server settings only through `updateGuildSettings`, because reads are cached.
- Migrations must stay compatible with the previous release ([production](docs/operations/production.md#releases)).
- Don't write comments that restate the code. Comment only non-obvious intent and tool directives (`biome-ignore`).
- Imports have no file extension. Imports that leave the current module or top-level folder use the `@/` alias (`@/core`, `@/i18n`, `@/modules/x/x.service`). Imports inside the same module stay relative (`../../tags.service`). `pnpm build` bundles with esbuild, which resolves both.
- Use pnpm, not npm or yarn. Never commit `.env`.

## Tests

No tautological tests. Each test must be able to fail when the behaviour is wrong:
- **Entry points:** drive the code through its public entry points: command and component handlers, events, jobs, services.
- **What to fake:** use a real test database. Fake only the Discord boundary, and only with the fields the code reads.
- **What to assert:** observable outcomes. That means rows written or deleted, messages sent, roles changed, and the user being refused with the right reason.
- **Don't assert:**
  - values the test just set;
  - that a fake returns what it was configured to return;
  - registration counts;
  - translated strings copied from the locale files;
  - that a function was called with arguments the code obviously passes.
- **Which cases:** pick cases that tell right from wrong logic. Include boundaries (the Nth warning, the threshold star, Feb 29, expiry times), concurrency (case numbers, starboard posts), permission and hierarchy refusals, and failure paths.

## Verify

```sh
pnpm typecheck && pnpm lint && pnpm build
```

`pnpm lint` runs Biome and the structure linter. If you changed slash command names, descriptions or options, `pnpm deploy-commands` must be run before they appear in Discord.

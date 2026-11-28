# Contributing to roboteco

Thanks for helping. This page covers how to set up, what a good change looks like, and how a pull request gets merged. The project rules themselves live in [AGENTS.md](AGENTS.md), and they apply to people and AI agents alike.

## Before you start

- **Look for an issue first.** If there's none for what you want to do, open one so the approach can be agreed before you write code. Small fixes and docs can go straight to a pull request.
- **One change per pull request.** A feature, a fix or a refactor, not several. A large change lands faster as a few pull requests that each make sense on their own.
- **Everything in the repo is in English:** code, comments, docs, scripts, commit messages and pull requests. Portuguese belongs only in the `pt-BR` locale files.
- **Security problems** go to the maintainers privately, through [a security advisory](https://github.com/butecodosdevs/roboteco/security/advisories/new), not in a public issue.

## Set up

You need [mise](https://mise.jdx.dev) and Docker. `mise install` brings the pinned Node.js, pnpm, Rust and Go. [Getting started](docs/getting-started.md) has the full list and how to create the Discord application.

```sh
mise install
cp .env.example .env     # DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID for your test server
pnpm install
pnpm plugins:build       # the WASM plugin fixtures pnpm test needs
pnpm services:up && pnpm storage:init && pnpm db:migrate
pnpm deploy-commands
pnpm dev
```

Use a Discord server of your own for testing, never the community server. With `NODE_ENV=development`, `/dev` fakes gateway events, so you can check logs and listeners without a second account ([testing events by hand](docs/getting-started.md#testing-events-by-hand)).

## Making a change

1. Find your task in [docs/README.md → How do I…](docs/README.md#how-do-i) and follow the linked example. Each concept doc ends with a complete example to copy.
2. New behaviour goes in a feature module under `src/modules/<feature>/`. `src/core/` is the framework; change it only when you're changing the framework itself.
3. Follow [AGENTS.md](AGENTS.md). The rules most often missed:
   - every user-facing string goes through i18n, with entries in both `en-US` and `pt-BR`;
   - the database changes only through `src/db/schema.ts` and `pnpm db:generate`, and a committed migration is never edited;
   - a new table with server or user data needs `onGuildRemove` and `onUserErase`;
   - components and staff actions check permissions themselves;
   - comments explain intent the code can't show, never what the code already says.
4. Add tests under `tests/`. They run against the real Postgres and Valkey and fake only Discord. A test must be able to fail when the behaviour is wrong, so assert outcomes: rows written, messages sent, roles changed, a refusal with the right reason. A quick way to check is to break the code on purpose and see the test fail. [AGENTS.md → Tests](AGENTS.md#tests) has the full rules.
5. Update the docs that describe what you changed.

## Before you open a pull request

Run the same checks the maintainers do:

```sh
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

`pnpm format` fixes formatting. If you changed a slash command's name, description or options, run `pnpm deploy-commands` and try it in your test server.

## Pull requests

- **Title:** a [Conventional Commits](https://www.conventionalcommits.org) title in English, such as `feat(tickets): close a ticket from its thread` or `fix(core): enforce default permissions at runtime`. Pull requests are squash-merged, so the title becomes the commit on `main`.
- **Description:** fill in the template:
  - what changes and why;
  - any breaking change and how to migrate;
  - what you ran and what it showed;
  - whether you tried it on a live server;
  - what to run after merging (`pnpm db:migrate`, `pnpm plugins:build`, `pnpm deploy-commands`).

  Keep it in step with the code as the pull request changes.
- **Review:** every pull request needs a maintainer's approval. Review comments are attached to the lines they're about. Resolve them with a new commit, or reply if you disagree. Maintainers may push small fixes to your branch to get it merged.
- **Branches:** branch from the latest `main`, and rebase when it moves ahead. Don't merge `main` into your branch.

## License

By contributing, you agree that your contributions are licensed under the [GNU General Public License v3.0](LICENSE), like the rest of the project.

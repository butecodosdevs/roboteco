# roboteco

Discord bot for the community, built with TypeScript, [discord.js](https://discord.js.org), PostgreSQL ([Drizzle](https://orm.drizzle.team)) and S3 storage ([Garage](https://garagehq.deuxfleurs.fr)).

## Quick start

```sh
mise install
cp .env.example .env   # fill in the Discord credentials
pnpm install
pnpm services:up && pnpm storage:init && pnpm db:migrate
pnpm deploy-commands
pnpm dev
```

See [docs/getting-started.md](docs/getting-started.md) for requirements, the Discord app setup and every environment variable, and [docs/operations/production.md](docs/operations/production.md) to deploy.

## Documentation

[docs/](docs/README.md) explains each concept (modules, commands, events, services, i18n, database, storage, structure rules) with a complete example, plus the honeypot feature as a real-world example. AI agents start at [AGENTS.md](AGENTS.md).

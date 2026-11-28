# roboteco docs

Each concept page has the same shape: **what it is**, **what it's for**, **how it works**, and a complete **example**.

## Start here

- [Getting started](getting-started.md): requirements, Discord app setup, environment variables, scripts.
- [Architecture](architecture.md): how the pieces fit, and what happens on a slash command.
- [Running in production](operations/production.md): Docker image, releases, logs, Sentry, health, backups, data lifecycle.

## Concepts

| Concept | Example |
| --- | --- |
| [Modules](concepts/modules.md) | a `dice` module with `/roll` |
| [Commands](concepts/commands.md) | `/announce`: guild-only, permissions, options |
| [Subcommands](concepts/subcommands.md) | `/tag add` and `/tag show` |
| [Events](concepts/events.md) | greeting a server when the bot joins |
| [Services and dependency injection](concepts/services.md) | `TagsService` |
| [Translations (i18n)](concepts/i18n.md) | translating `tags`; adding Spanish |
| [Database](concepts/database.md) | the `tags` table and its migration |
| [File storage](concepts/storage.md) | saving images |
| [Cache (Valkey)](concepts/cache.md) | airdrops: counters, cooldowns, a random draw |
| [Components](concepts/components.md) | a vote button; a report modal |
| [Context menus](concepts/context-menus.md) | right-click → Report message |
| [Scheduled jobs](concepts/jobs.md) | reminders |
| [Plugins (WASM)](concepts/plugins.md) | Community plugins in Rust or Go: commands, menus, buttons, forms, events and scheduled runs, acting through permission-checked capabilities in a sandbox |
| [Structure rules](concepts/structure-rules.md) | fixing a failing lint |

## Examples from this repository

- [Community features](examples/community-features.md): tags, suggestions, self-roles, reports, tickets, levels, starboard, welcome, logs, reminders, verification, anti-raid, giveaways, scheduled posts, birthdays, feeds, custom commands, counting, invite tracking, AutoMod, airdrops, temporary voice channels.
- [Privacy and data lifecycle](examples/privacy.md): `/privacy`, module erase and purge hooks.
- [Moderation](examples/moderation.md): commands sharing one service for checks, numbered cases and a moderation log.
- [Honeypot](examples/honeypot.md): a complete feature using every concept, which logs its bans through moderation.
- [Safety](examples/safety.md): removes links and files that threat databases and ClamAV confirm are malicious, with rechecks.

## How do I…

| Goal | Go to |
| --- | --- |
| Add a feature | [Modules → example](concepts/modules.md#example-a-dice-module-with-roll) |
| Add a slash command | [Commands → example](concepts/commands.md#example-announce-a-server-only-command-for-moderators) |
| Group actions under one command | [Subcommands → example](concepts/subcommands.md#example-tag-add-and-tag-show) |
| React to messages, joins, deletions | [Events → example](concepts/events.md#example-introduce-the-bot-when-it-joins-a-server) |
| Share state or query the database | [Services → example](concepts/services.md#example-tagsservice) |
| Show text to users or add a language | [i18n → examples](concepts/i18n.md#example-translating-the-tags-module) |
| Add a table or column | [Database → example](concepts/database.md#example-a-tags-table) |
| Count, rate-limit or expire things quickly | [Cache → example](concepts/cache.md#example-airdrops) |
| Keep images or files | [Storage → example](concepts/storage.md#example-saving-images) |
| Add buttons, menus or forms | [Components](concepts/components.md) |
| Act on a right-clicked user or message | [Context menus](concepts/context-menus.md) |
| Run something later | [Scheduled jobs](concepts/jobs.md) |
| Limit how often a command can be used | [Commands → cooldowns](concepts/commands.md#cooldowns) |
| Store new user or server data | [Privacy → module hooks](examples/privacy.md#module-hooks) |
| Deploy, back up or restore | [Production](operations/production.md) |
| Understand a lint error | [Structure rules](concepts/structure-rules.md#how-it-works) |

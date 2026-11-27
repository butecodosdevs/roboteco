# Database

## What it is

Persistent data lives in PostgreSQL, accessed through [Drizzle ORM](https://orm.drizzle.team):
- **Schema.** Tables are defined in TypeScript in `src/db/schema.ts`, and queries are type-checked against them.
- **Migrations.** Changes to the database are SQL files in `drizzle/`, generated from the schema.
- **Locally**, `compose.yaml` runs PostgreSQL.

## What it's for

Anything that must survive a restart: per-server settings (the honeypot channel), user content (tags), history. Keep data you can rebuild cheaply, and caches, in memory in a [service](services.md).

## How it works

- `db` and `schema` come from `src/db/index.ts`. Queries belong in services, not in commands or events.
- To change the schema:
  1. Edit `src/db/schema.ts`.
  2. Run `pnpm db:generate --name <change>` and read the SQL it writes.
  3. Run `pnpm db:migrate`.
  4. Commit the schema change and the migration together.
- Never edit a committed migration. Write a new one instead. `pnpm db:push` skips migrations and is only for throwaway local experiments.
- **Conventions:**
  - snake_case column names;
  - Discord IDs (snowflakes) stored as `text`;
  - `createdAt` on every table.
- **Per-server settings** are columns on `guilds`. Read and write them with `getGuildSettings(guildId)` and `updateGuildSettings(guildId, locale, changes)` from `src/db/index.ts`. The update is an upsert, because servers joined before a feature existed have no row yet. These two helpers are the one exception to keeping queries in services. Reads are cached in memory for 5 minutes, and `updateGuildSettings` clears the entry, so always write settings through it. A direct `db.update(schema.guilds)` would be served stale for up to 5 minutes.
- `pnpm db:studio` opens a browser UI for the data.

## Example: a `tags` table

This is a simplified version of the real `src/modules/tags/`, which also has `/tag list`, `/tag delete` and autocomplete.

Server text snippets, one per name per server. It is used by `TagsService` in [services](services.md#example-tagsservice).

Add to `src/db/schema.ts` (and import `primaryKey` from `drizzle-orm/pg-core`):

```ts
export const tags = pgTable(
  'tags',
  {
    guildId: text('guild_id').notNull(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    authorId: text('author_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.name] })],
);
```

Generate and apply the migration:

```sh
pnpm db:generate --name tags   # writes drizzle/NNNN_tags.sql
pnpm db:migrate
```

The generated `drizzle/NNNN_tags.sql` (in this repository, the real table was created by `drizzle/0003_community_features.sql`):

```sql
CREATE TABLE "tags" (
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_guild_id_name_pk" PRIMARY KEY("guild_id","name")
);
```

The composite primary key gives the "one name per server" rule for free: `TagsService.add` uses `onConflictDoNothing()` and reports whether a row was inserted.

# Services and dependency injection

## What it is

A service is a class decorated with `@Injectable()` that owns one piece of state or data access, such as a cache, a set of database queries or a storage client. `inject(Service)` returns the service's single shared instance, creating it on first use, so every command, subcommand, event and module that injects it sees the same object. This mirrors Angular's `inject()`.

## What it's for

- **Shared state.** A command that changes a setting and an event that reads it must agree. The service is the one place that holds it.
- **Data access in one place.** Commands and events describe *what* happens, and the service decides *how* it is stored. Queries don't get copied around.
- **Caching.** Hot paths (an event that fires on every message) read memory, not the database.
- **Swappable dependencies.** `provide(Service, fake)` replaces the instance, for example in a test.

Create a service when more than one class needs the same data, or when a class talks to the database or storage.

## How it works

- Files: `<feature>/<name>.service.ts` at the module root, with the class named `*Service`.
- Inject in a field initializer: `private readonly tags = inject(TagsService);`. Constructor injection isn't supported, because `tsx` can't emit the type metadata it needs.
- Services are created lazily, once per process, with no constructor arguments.
- Another module may import and inject your service. That and `*.module.ts` are a module's only public surface.
- `provide(Service, instance)` must run before anything that injects the service is constructed.
- Never keep state in module-level variables. Put it in a service.

## Example: `TagsService`

This is a simplified version of the real `src/modules/tags/`, which also has `/tag list`, `/tag delete` and autocomplete.

It stores the server text snippets used by [`/tag add` and `/tag show`](subcommands.md#example-tag-add-and-tag-show), in the `tags` table defined in [database](database.md#example-a-tags-table).

**`src/modules/tags/tags.service.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import { Injectable } from '@/core';
import { db, schema } from '@/db';

@Injectable()
export class TagsService {
  async add(guildId: string, name: string, content: string, authorId: string): Promise<boolean> {
    const inserted = await db
      .insert(schema.tags)
      .values({ guildId, name, content, authorId })
      .onConflictDoNothing()
      .returning({ name: schema.tags.name });
    return inserted.length > 0;
  }

  async find(guildId: string, name: string): Promise<string | undefined> {
    const [tag] = await db
      .select({ content: schema.tags.content })
      .from(schema.tags)
      .where(and(eq(schema.tags.guildId, guildId), eq(schema.tags.name, name)));
    return tag?.content;
  }
}
```

Using it:

```ts
export class ShowSubcommand {
  private readonly tags = inject(TagsService);

  async execute(interaction: GuildInteraction) {
    const content = await this.tags.find(interaction.guildId, 'rules');
  }
}
```

### Variation: a cached service

When an event reads the data on every message, load it once and keep memory and the database in sync:

```ts
@Injectable()
export class SettingsService {
  private readonly cache = new Map<string, Settings>();

  async load() {}                    // fill the cache; call it from the module's onReady
  get(guildId: string) {}            // read from the cache only
  async set(guildId: string, value: Settings) {}  // write the database, then the cache
}
```

`HoneypotService` (`src/modules/honeypot/honeypot.service.ts`) follows this pattern. See [the honeypot example](../examples/honeypot.md).

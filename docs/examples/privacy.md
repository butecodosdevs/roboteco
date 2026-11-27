# Example: privacy and data lifecycle

Code: `src/modules/privacy/`, `src/modules/guilds/` and the module hooks in `src/core/lifecycle.ts`.

| Command | Who | Effect |
| --- | --- | --- |
| `/privacy info` | anyone | Lists what the bot stores and the retention period |
| `/privacy delete` | anyone (60s cooldown) | After a confirm button, deletes your data in every server |
| `/privacy forget user` | Manage Server | After a confirm button, deletes that member's data in this server |

Only the member who ran the command can press its confirm button.

## Module hooks

Each module owns its tables, so each module erases its own rows. Implement either or both on the module class:

```ts
@Module({ commands: [TagCommand] })
export class TagsModule implements OnGuildRemove, OnUserErase {
  private readonly tags = inject(TagsService);

  onGuildRemove(guildId: string) {
    return this.tags.purgeGuild(guildId);
  }

  onUserErase(userId: string, guildId?: string) {
    return this.tags.eraseUser(userId, guildId);
  }
}
```

- `onUserErase` gets `guildId` only for `/privacy forget`, which is limited to one server. `userScope(userColumn, userId, guildColumn, guildId)` from `src/db` builds the right `where` clause for both cases.
- `onGuildRemove` runs `GUILD_DATA_RETENTION_DAYS` after the bot leaves a server, and only if it hasn't been re-added.
- Rows in `guilds` (per-server settings) are deleted by the purge itself.

**When you add a table that stores server or user data, add these hooks for it.**

| Module | `onGuildRemove` | `onUserErase` |
| --- | --- | --- |
| tags | all tags | tags the user wrote |
| suggestions | all suggestions and votes | their suggestions and votes |
| reports | all reports | reports they filed |
| tickets | all tickets | their tickets |
| levels | XP and rewards | their XP |
| reminders | reminders set in the server, and their jobs | their reminders, and their jobs |
| roles, starboard | their tables | — |
| moderation | all cases | — (cases are kept as server records) |
| honeypot | its in-memory cache | — |

## Verified

Tested against the local database:
- erasing a member in one server keeps their data in other servers;
- erasing everywhere removes it all and cancels their pending reminder jobs, but keeps moderation cases;
- the purge job runs 30 days after the bot leaves, is cancelled when the bot is re-added, and deletes the `guilds` row when it runs.

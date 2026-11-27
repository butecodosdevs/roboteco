# Cache (Valkey)

## What it is

[Valkey](https://valkey.io), the open-source Redis fork, is an in-memory key-value store that runs next to Postgres in Docker Compose. `src/cache/index.ts` exports one shared client, `cache` (from [iovalkey](https://github.com/valkey-io/iovalkey), which has the same API as ioredis). It connects on first use, and every key is prefixed with `roboteco:`.

## What it's for

Short-lived, fast-changing state that is shared and must survive a bot restart, but doesn't need to be kept forever:
- counters (messages since the last drop);
- cooldowns and rate limits (XP once a minute);
- things that expire by themselves (an unclaimed drop);
- "first one wins" decisions, which need an atomic operation.

Use Postgres for anything you'd be upset to lose. Locally Valkey runs without persistence (`--save "" --appendonly no`), and in production it evicts expiring keys when memory runs out, so treat every key as disposable. Plain in-process `Map`s are still fine for caches that are rebuilt from Postgres at startup, such as the honeypot or drop channel settings.

## How it works

- **Name keys** `<module>:<what>:<ids>`, e.g. `drops:count:<channelId>`. The `roboteco:` prefix is added for you.
- **Always set a TTL** unless the key is deleted explicitly: `set(key, value, 'EX', seconds)` or `'PX', ms`.
- **Use atomic commands** instead of read-then-write:

| Need | Command |
| --- | --- |
| Count | `incr` |
| Only once per window | `set(key, '1', 'PX', ms, 'NX')`, which returns `null` if the key is already set |
| First one wins, and remove | `getdel` |
| Was it still there? | `del`, which returns the number of keys removed |

- **Clean up:** a module's `onGuildRemove` must delete its keys too (`DropsService.disable` deletes the counter).
- **Health:** `/health` reports `"cache": "ok" | "unavailable"`. Configure the client with `VALKEY_URL` (default `redis://localhost:6379`, `redis://valkey:6379` in `compose.prod.yaml`).

## Example: airdrops

`src/modules/drops/`: every N messages in a channel, the bot posts an airdrop and reacts with 🎁. Everyone who reacts before the draw goes into a list kept in Valkey, and the bot picks the winners at random.

```ts
// every message: counts toward the next airdrop (one per member per 5 s, so flooding doesn't help)
const counted = await cache.set(`drops:seen:${channelId}:${userId}`, '1', 'PX', 5_000, 'NX');
if (!counted) return undefined;
const count = await cache.incr(`drops:count:${channelId}`);

// reaction added / removed: the entrant list is a Valkey set
await cache.sadd(`drops:entrants:${messageId}`, userId);
await cache.srem(`drops:entrants:${messageId}`, userId);

// draw: GETDEL makes sure it happens once, SRANDMEMBER picks distinct random winners
const raw = await cache.getdel(`drops:active:${messageId}`);
if (!raw) return undefined;
const winnerIds = await cache.srandmember(`drops:entrants:${messageId}`, drop.winners);
```

- A [job](jobs.md) runs the draw when the airdrop's time is up. It pays each winner through `LevelsService.grant`, edits the airdrop to show the winners, and posts a reply that pings only them.
- Reactions are only accepted while the airdrop is open (`drops:active:<messageId>` exists), so late reactions are ignored. The bot's own reaction and other emoji are ignored too.
- Wins are the one thing worth keeping, so they go to Postgres (`drop_claims`, `/drops top`).

Tested against a real Valkey and Postgres:
- 30 simultaneous reactions, 5 of them removed, give 25 entrants, and the 3 winners all come from those 25;
- two racing draws produce one result;
- reactions after the draw are ignored;
- with fewer entrants than winners, everyone wins once;
- the pick is random (both of two entrants win across repeated draws);
- the job pays exactly the winners, pings only them, and does nothing when run again;
- with no entries, the airdrop says so and nobody is paid.

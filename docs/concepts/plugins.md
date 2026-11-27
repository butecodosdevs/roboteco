# Plugins (WASM)

## What it is

A plugin is a WebAssembly module that adds slash commands to the bot. It can be written in any language that compiles to WASM; there are SDKs for **Rust** (`plugins/sdk/rust`) and **Go** (`plugins/sdk/go`). The bot runs plugins in [Extism](https://extism.org) sandboxes inside worker threads.

A plugin never sees the Discord token, the database, the disk or the network. It receives JSON, returns JSON, and reaches bot data only through **capabilities**: existing service methods the bot exposes, each behind a permission.

Code:
- `src/modules/plugins/`: the engine, registry, manifest and contract schemas, host capabilities, and Discord data;
- `src/core/expose.ts`: `@Expose`;
- `src/lib/wasm.ts`: import inspection and the memory cap;
- `plugins/`: SDKs, examples and fixtures.

## What it's for

Letting the community add features without trusting their code. A broken or hostile plugin is stopped after 2 seconds and capped at 64 MB. It can only call capabilities it declared and the server granted, and it only ever sees the server it was called from.

## Quick start

**Rust.** Add `extism-pdk` and `roboteco = { path = "plugins/sdk/rust" }` to your `Cargo.toml` (`crate-type = ["cdylib"]`):

```rust
use extism_pdk::*;
use roboteco::*;

#[plugin_fn]
pub fn manifest() -> FnResult<Json<Manifest>> {
    Ok(Json(
        Manifest::new("hello", "1.0.0")
            .uses(&["kv.increment"])
            .command(CommandSpec::new("count", "Count your uses").localized("pt-BR", "contar", "Conta seus usos")),
    ))
}

#[plugin_fn]
pub fn handle_command(Json(cmd): Json<Command>) -> FnResult<Json<Response>> {
    let total = kv::increment(&format!("count:{}", cmd.user_id), 1)?;
    Ok(Json(Response::reply(format!("<@{}> counted **{total}**", cmd.user_id))))
}
```

Build with `cargo build --release --target wasm32-unknown-unknown`.

**Go.** Add `roboteco.dev/sdk`, and build with `GOOS=wasip1 GOARCH=wasm go build -buildmode=c-shared -o plugin.wasm .`:

```go
//go:wasmexport manifest
func manifest() int32 {
	return roboteco.Manifest(roboteco.Plugin{
		Name: "coin", Version: "1.0.0", Uses: []string{"kv.increment"},
		Commands: []roboteco.CommandSpec{{Name: "flip", Description: "Flip a coin"}},
	})
}

//go:wasmexport handle_command
func handleCommand() int32 { return roboteco.HandleCommand(run) }

func run(cmd roboteco.Command) (roboteco.Response, error) {
	n, err := roboteco.KV.Increment("flips:"+cmd.UserID, 1)
	return roboteco.Reply(fmt.Sprintf("flip #%d", n)), err
}
```

**Try it without Discord**, against the local Postgres and Valkey:

```sh
pnpm plugin check plugin.wasm                         # validates the manifest, lists commands and the permissions to grant
pnpm plugin run plugin.wasm count                     # runs /count and prints the reply
pnpm plugin run plugins/dist/coin.wasm coin flip call=heads --locale pt-BR --user 123456789012345678
```

`run` checks option names, types and required options against the manifest. It uses a fake member and server (`100000000000000001`), and gives the plugin every permission it asks for.

**Install it.** Add `{ "id", "wasm", "permissions" }` to `plugins/registry.json`, using the permissions `pnpm plugin check` printed. Restart the bot and run `pnpm deploy-commands`.

## How it works

**Exports**

| Export | Input | Output |
| --- | --- | --- |
| `manifest` | — | `{ name, version, commands, uses, context }` |
| `handle_command` | `Command` | `{ actions: [{ type: "reply", content, ephemeral? }] }`, up to 5 actions, each at most 2000 characters. Mentions never ping. |
| `autocomplete` (optional) | `Command` with `focused: { name, value }` | `{ choices: [{ name, value }] }`, up to 25 |

`Command` is `{ command, subcommand, options, userId, guildId, channelId, locale, context?, resolved? }`:
- **`options`:** the values the member typed. Users, roles and channels arrive as IDs.
- **`resolved`:** the members, roles and channels picked in those options, sent by Discord with the interaction. A plugin never has to look them up.
- **`context`:** the calling `member`, `guild` and `channel`, for each kind listed in the manifest's `context`. Built from discord.js's cache, with no API call.

The SDKs wrap all of this, e.g. `cmd.member("who")` and `cmd.context.guild`.

**Commands** are real slash commands with typed options (string, integer, number, boolean, user, channel, role), subcommands, choices, ranges, autocomplete, translations, default permissions, and server-only (the default) or DM use. The manifest is checked against Discord's rules before deploy. A command name that clashes with a built-in command or another plugin is refused. `pnpm deploy-commands` registers plugin commands next to the built-in ones, through the core `OnCommandDeploy` hook.

**Capabilities.** The only host function is `call({ name, input })`, which returns `{ ok: true, value }` or `{ ok: false, error: { code, message } }`. The SDKs wrap it as typed functions (`kv::increment`, `roboteco.Levels.Get`, …). Every capability is a service method marked with `@Expose`. The plugin uses the same code the bot's own commands use, and adding one is a decorator:

```ts
@Expose('levels.get', {
  permission: 'levels.read',
  description: "A member's XP, level and leaderboard position in this server",
  input: z.object({ userId: snowflake }),
  output: z.object({ xp: z.number(), level: z.number(), rank: z.number().nullable() }),
})
async levelOf(scope: PluginScope, { userId }: { userId: string }) { … }
```

| Capability | Permission | Notes |
| --- | --- | --- |
| `kv.get`, `kv.set`, `kv.delete`, `kv.increment`, `kv.list` | `kv` | Valkey, one space per plugin and server. Keys up to 128 bytes, values up to 4 KB, 1000 keys. `increment` is atomic. |
| `levels.get`, `levels.top` | `levels.read` | `LevelsService`, the same as `/rank` and `/leaderboard` |
| `xp.grant` | `xp.grant` | 1 to 100 XP for the member who ran the command |
| `moderation.history` | `moderation.read` | `CasesService`, public case fields only |
| `discord.member.get` | `discord.read` | Members not in `resolved` or `context`; cache first |
| `log` | — | Usable without declaring it |

`pnpm plugin schema` writes `plugins/sdk/schema.json`: JSON Schema for the manifest, both exports' input and output, and every capability. It can be used to generate SDKs in other languages.

**Checks** made by the engine, so services don't repeat them:
- **Declaration and permissions:**
  - a capability must be listed in the manifest's `uses`, otherwise the call fails with `not_declared` and the message names the fix;
  - at load time, the permissions of everything in `uses` must be granted in `plugins/registry.json`;
  - a load failure lists every missing permission and what needs it, and misspelled permissions are listed next to the valid ones.
- **Scope:** comes from the interaction. Input that names another server is ignored.
- **Input** is validated: an `invalid_input` error names the field. **Output** is cut down to the capability's schema.
- **Rate limit:** 200 calls per 10 seconds per plugin and server (`rate_limited`).
- **Service errors:** services throw `CapabilityError(code, message)` for errors a plugin can handle (`storage_full`). Anything else returns `failed` and is logged.
- **Imports:** a plugin that imports anything except `call` (or Extism's HTTP functions, which need `http` and `allowedHosts`) is refused.

**Limits:**
- 2 seconds per call, plus a watchdog;
- 64 MB of memory;
- no filesystem;
- WASI only for modules that need it (Go);
- calls to one plugin are queued, so plugin code never runs concurrently.

## Examples

All of these are built with `pnpm plugins:build`.

| Plugin | Shows |
| --- | --- |
| `plugins/hello-rust` | `/hello [who] [style]` (autocomplete), `/count` (`kv.increment`), `/profile [who]` (resolved and context members, `levels.get`). 73 lines; it was 153 without the SDK |
| `plugins/coin-go` | `/coin flip call:heads\|tails`, `/coin stats`: subcommands, choices, KV. 72 lines; it was 115 |
| `plugins/fixtures/evil-rust`, `greedy-rust` | Hostile tests: loops, memory, network, calling capabilities it shouldn't, too much XP |

Tested against the real Postgres and Valkey:
- `/profile who:@Ana` uses the member Discord sent and makes no lookup;
- 20 concurrent `/count` calls end at exactly 20;
- the Go plugin works through its SDK;
- undeclared, unknown and malformed calls return `not_declared` (with the fix), `unknown` and `invalid_input` (naming the field);
- `log` works without declaring it;
- `xp.grant` rejects 1,000,000 and grants 100;
- loading without permissions lists all of them with their reasons, and a misspelled permission shows the valid ones;
- the earlier sandbox tests (loops, memory, network, scope spoofing, rate limits) still pass.

## What the POC found

- **Extism's JS SDK doesn't cap a plugin's own memory.** `memory.maxPages` only limits Extism's internal allocations; a plugin could grow to 4 GB. `capMemory` in `src/lib/wasm.ts` rewrites the module's memory section to declare a maximum, and refuses shared memory, 64-bit memory and imported memory.
- **Timeouts and the HTTP allowlist need `runInWorker`.** It's marked experimental, and after a crash the worker could hang on the next timeout ("Plugin failed to restart during a timeout"). The engine therefore replaces the instance after every failure and puts its own deadline on each call.
- **Go needs WASI** for its runtime. The bot enables WASI only for modules that import it, with no files and no environment variables.

## Next steps

- Domain events plugins can subscribe to (`levels.levelUp`, `moderation.caseCreated`).
- More actions: embeds, buttons, roles, moderation through `ModerationService`.
- Install per server with `/plugins install`, an approval prompt for permissions, and modules pinned by hash.
- Signed webhooks for plugins in languages WASM handles badly, using the same contract.
- A TypeScript SDK (via the JS PDK), generated from `plugins/sdk/schema.json`.
- Running plugins in production: the Docker image doesn't copy `plugins/` yet.

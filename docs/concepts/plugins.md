# Plugins (WASM, proof of concept)

## What it is

Code: `src/modules/plugins/` (engine, registry, manifest validation), `src/lib/wasm.ts` (import inspection, memory cap), example plugins in `plugins/`.

A plugin is a WebAssembly module, written in any language that compiles to WASM, that adds commands to the bot. The bot runs it inside [Extism](https://extism.org), a sandbox in a worker thread. The plugin never sees the Discord token, the disk or the network. It gets JSON in, returns JSON *actions* out, and can only call the host functions it was granted.

Plugins declare their own slash commands, which show up in Discord like the built-in ones (`/hello`, `/coin flip`). `/plugin list` shows what's installed.

## What it's for

Letting the community extend the bot without trusting their code. A broken or hostile plugin can:
- loop forever: it's stopped after 2 seconds;
- eat memory: it's capped at 64 MB;
- call the network: blocked unless granted, and then only to the hosts on its allowlist;
- store data: only in its own space for each server.

It can't take the bot down with it.

## How it works

**Contract (v1)**

| Export | Input | Output |
| --- | --- | --- |
| `manifest` | — | `{ name, version, commands: [CommandSpec] }`, at most 25 commands |
| `handle_command` | `{ command, subcommand, options, userId, guildId, channelId, locale }` | `{ actions: [{ type: "reply", content, ephemeral? }] }` (up to 5, each content at most 2000 characters) |
| `autocomplete` (optional) | the same, plus `focused: { name, value }` | `{ choices: [{ name, value }] }` (up to 25) |

A `CommandSpec` describes a real slash command:

```json
{
  "name": "coin", "description": "Flip coins",
  "nameLocalizations": { "pt-BR": "moeda" }, "descriptionLocalizations": { "pt-BR": "Joga moedas" },
  "subcommands": [{
    "name": "flip", "description": "Flip a coin",
    "options": [{ "type": "string", "name": "call", "description": "Heads or tails?", "required": true,
                  "choices": [{ "name": "heads", "value": "heads" }, { "name": "tails", "value": "tails" }] }]
  }],
  "defaultMemberPermissions": ["ManageGuild"],
  "guildOnly": true
}
```

- **Option types:** `string`, `integer`, `number`, `boolean`, `user`, `channel`, `role`, with `required`, `choices`, `autocomplete`, `minValue`/`maxValue` and `minLength`/`maxLength`. A command has either `options` or `subcommands`, not both.
- **Values the plugin receives:** `options` holds the values the member typed. Users, channels and roles arrive as IDs.
- **Server-only:** `guildOnly` defaults to `true`.
- **Refused before Discord sees it:** the manifest is checked against Discord's rules. Names must be lowercase, required options must come before optional ones, locale codes must be valid Discord locales, and `choices` can't be combined with `autocomplete`. A plugin whose command name clashes with a built-in command or another plugin is refused.
- **Registration:** `pnpm deploy-commands` loads the plugins in `plugins/registry.json` and registers their commands alongside the built-in ones. This goes through the core `OnCommandDeploy` module hook, so `deploy-commands.ts` doesn't depend on any feature. At runtime, `PluginsModule` routes those commands and their autocomplete to the plugin, with server-only checks and a 2-second cooldown per member and command.

The output is validated with zod. Anything else is rejected, and the user gets "the plugin sent a response I could not use". Replies are always sent with `allowedMentions: { parse: [] }`, so a plugin can't ping anyone.

**Host functions and permissions.** Imports from `extism:host/user`:

| Function | Permission | Notes |
| --- | --- | --- |
| `kv_get(key) -> value`, `kv_set({key, value})`, `kv_del(key)` | `kv` | One Valkey hash per plugin and server. Keys up to 128 bytes, values up to 4 KB, 1000 keys |
| `xp_grant(amount) -> granted` | `xp.grant` | Gives XP to the member who ran the command, at most 100 per call, through `LevelsService` |
| `log(message)` | — | Goes to the bot's logs |
| Extism's `http_request` | `http` | Only hosts in the plugin's `allowedHosts` |

**Permissions come from the module, not from the author's claims.** At load time the bot reads the WASM's imports. If the module imports a function whose permission isn't granted in `plugins/registry.json`, or a function the bot doesn't know, the plugin is refused before it ever runs.

**Limits** (`limits` in `plugin-engine.service.ts`): 2 s per call, with a watchdog 1 s later in case the worker itself hangs; 64 MB of memory; no filesystem (`allowedPaths: {}`); WASI only for languages that need it (Go). Calls to one plugin are queued, so plugins don't need to handle concurrency and 10 simultaneous counters lose no updates.

**Installing (POC):** `plugins/registry.json` lists `{ id, wasm, permissions, allowedHosts? }`. The plugins are loaded when the bot starts.

## Example: a Rust and a Go plugin

`plugins/hello-rust` (`/hello [who] [style]` with autocomplete for `style`, and `/count`) and `plugins/coin-go` (`/coin flip call:heads|tails`, `/coin stats`). Both are localized to pt-BR (`/ola`, `/moeda jogar`). Build both with `pnpm plugins:build`, which needs Rust's `wasm32-unknown-unknown` target and Go 1.24+.

```rust
#[host_fn]
extern "ExtismHost" {
    fn kv_get(key: String) -> String;
    fn kv_set(input: Json<KvSet>);
}

#[plugin_fn]
pub fn handle_command(Json(input): Json<CommandInput>) -> FnResult<Json<serde_json::Value>> {
    let key = format!("count:{}", input.user_id);
    let next: u64 = unsafe { kv_get(key.clone())? }.parse().unwrap_or(0) + 1;
    unsafe { kv_set(Json(KvSet { key, value: next.to_string() }))? };
    Ok(Json(json!({ "actions": [{ "type": "reply", "content": format!("**{next}**") }] })))
}
```

```go
//go:wasmimport extism:host/user kv_get
func kvGet(uint64) uint64

//go:wasmexport handle_command
func handleCommand() int32 {
	var input commandInput
	pdk.InputJSON(&input)
	pdk.OutputJSON(map[string]any{"actions": []action{{Type: "reply", Content: "🪙 heads"}}})
	return 0
}
```

Built sizes: Rust 126 KB, Go 4.5 MB. Both load in about 30 ms.

`plugins/fixtures` holds hostile test plugins: `evil` (an infinite loop, a memory bomb, a network call) and `greedy` (asks for a million XP). Tested against a real Valkey and Postgres:
- deploying turns the manifests into slash commands with localizations, typed options, subcommands, choices and autocomplete;
- invalid manifests (uppercase names, a required option after an optional one, options and subcommands together, unknown locales, choices combined with autocomplete) are refused, and so are names that clash with `/ban` or another plugin;
- typed options reach the plugin (`/hello who:@friend style:pirate` → "Ahoy! Hello, <@friend>! ☠️"), and the Go plugin's subcommands and choices work;
- autocomplete asks the plugin, server-only commands are refused in DMs, and a quick second use hits the cooldown;
- the Rust and Go plugins reply without pinging anyone;
- storage persists and is separate for each server and each plugin;
- 10 simultaneous calls produce a count of 10;
- `greedy` is refused without `xp.grant`, and with it gets the 100 cap, not a million;
- `evil` is refused without `http`, and with it can't reach `169.254.169.254`;
- the infinite loop is stopped after about 2 s, and other plugins keep working;
- the memory bomb fails in 36 ms with the bot's memory growing about 65 MB;
- the plugin still works after a crash and a timeout;
- removing a server's data deletes the plugin data.

## What the POC found

- **Extism's JS SDK doesn't cap a plugin's own memory.** `memory.maxPages` only limits Extism's internal allocations; a plugin could grow to 4 GB. `capMemory` in `src/lib/wasm.ts` rewrites the module's memory section to declare a maximum, and refuses shared memory, 64-bit memory and imported memory.
- **Timeouts and the HTTP allowlist need `runInWorker`.** It's marked experimental, and after a crash the worker could hang on the next timeout ("Plugin failed to restart during a timeout"). The engine therefore replaces the instance after every failure and puts its own deadline on each call.
- **Go needs WASI** for its runtime. The bot enables WASI only for modules that import it, with no files and no environment variables.

## Next steps

- A typed contract (WIT or JSON Schema) with generated SDKs; the manifest is already validated with zod and could be exported as JSON Schema.
- More actions: embeds, buttons, roles, moderation through `ModerationService`.
- Install per server with `/plugins install`, an approval prompt for permissions, and modules pinned and signed by hash.
- Signed webhooks for plugins in languages WASM handles badly.
- Running plugins in production: the Docker image doesn't copy `plugins/` yet.

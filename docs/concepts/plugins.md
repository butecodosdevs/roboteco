# Plugins (WASM)

## What it is

A plugin is a WebAssembly module that adds features to the bot. It can be written in any language that compiles to WASM. There are SDKs for **Rust** (`plugins/sdk/rust`) and **Go** (`plugins/sdk/go`). The bot runs plugins in [Extism](https://extism.org) sandboxes inside worker threads.

A plugin can do what a built-in feature does:
- **Triggers:** slash commands, autocomplete, context menus, buttons, select menus and forms, every Discord gateway event (and a few bot events), and runs it scheduled itself.
- **Answers:** text, embeds, buttons, select menus, editing the message a button is on, and opening forms.
- **Actions:** posting, editing and deleting messages, reactions, DMs, threads, roles, moderation, storage, levels and XP.

A plugin never sees the Discord token, the database, the disk or the network. It receives JSON and returns JSON. Everything else goes through **capabilities**: service methods the bot exposes, each behind a permission an admin grants.

Code:
- `src/modules/plugins/`:
  - `plugin-engine.service.ts`: loading, the sandbox and calls;
  - `plugin-manifest.service.ts`: the contract schemas;
  - `events/interaction-create.event.ts`: answering interactions;
  - `plugin-*.service.ts`: the capabilities.
- `src/core/expose.ts`: `@Expose` and the caller rules.
- `src/lib/wasm.ts`: import inspection and the memory cap.
- `plugins/`: SDKs, examples, fixtures, `registry.json` (empty in releases) and `registry.example.json` (the examples).

## What it's for

Letting the community add features without trusting their code:
- **Stopped when stuck:** a broken or hostile plugin is stopped after 2 seconds and capped at 64 MB.
- **Limited to its grants:** it can only use capabilities it declared and the server granted, and only in the server it was called from.
- **No more than the member could do:** a plugin can't do for a member what the member couldn't do themselves.

## Quick start

**Rust.** Add `extism-pdk` and `roboteco = { path = "plugins/sdk/rust" }` to your `Cargo.toml` (`crate-type = ["cdylib"]`). A counter with a button:

```rust
use extism_pdk::*;
use roboteco::*;

#[plugin_fn]
pub fn manifest() -> FnResult<Json<Manifest>> {
    Ok(Json(
        Manifest::new("counter", "1.0.0")
            .uses(&["kv.increment"])
            .command(CommandSpec::new("count", "Count your uses").localized("pt-BR", "contar", "Conta seus usos")),
    ))
}

#[plugin_fn]
pub fn handle_command(Json(cmd): Json<Command>) -> FnResult<Json<Response>> {
    Ok(Json(Response::reply(counter(&cmd)?)))
}

// The button's click comes back here, by the id the plugin gave it.
#[plugin_fn]
pub fn handle_component(Json(cmd): Json<Command>) -> FnResult<Json<Response>> {
    Ok(Json(Response::update(counter(&cmd)?)))
}

fn counter(cmd: &Command) -> Result<Message, Error> {
    let total = kv::increment(&format!("count:{}", cmd.user_id), 1)?;
    Ok(Message::text(format!("<@{}> counted **{total}**", cmd.user_id))
        .buttons([Button::primary("count", "Count again").emoji("➕")]))
}
```

Build with `cargo build --release --target wasm32-unknown-unknown`. The SDK also has `Embed`, `Select`, `Modal`, `ContextMenu`, typed `Event` and `Job` inputs, and a module per capability family (`messages::send`, `roles::add`, `moderation::timeout`, `schedule::create`, …). Errors are `CallError`, so `e.is("xp_limit")` can be matched.

**Go.** Add `roboteco.dev/sdk`, and build with `GOOS=wasip1 GOARCH=wasm go build -buildmode=c-shared -o plugin.wasm .`. A reminder: a command schedules a run, and the run posts in the channel:

```go
//go:wasmexport manifest
func manifest() int32 {
	return roboteco.Manifest(roboteco.Plugin{
		Name: "remind", Version: "1.0.0",
		Uses: []string{"schedule.create", "discord.messages.send"},
		Commands: []roboteco.CommandSpec{{Name: "nudge", Description: "Remind me later", Options: []roboteco.OptionSpec{
			{Type: "integer", Name: "in", Description: "Minutes", Required: true, MinValue: roboteco.Ptr(1.0)},
			{Type: "string", Name: "text", Description: "What", Required: true},
		}}},
	})
}

type reminder struct{ ChannelID, UserID, Text string }

//go:wasmexport handle_command
func handleCommand() int32 {
	return roboteco.HandleCommand(func(cmd roboteco.Command) (roboteco.Response, error) {
		r := reminder{cmd.ChannelID, cmd.UserID, cmd.String("text")}
		at, err := roboteco.Schedule.In("remind:"+cmd.UserID, time.Duration(cmd.Int("in"))*time.Minute, r)
		return roboteco.Private(fmt.Sprintf("⏰ I'll remind you <t:%d:R>.", at.Unix())), err
	})
}

//go:wasmexport handle_job
func handleJob() int32 {
	return roboteco.HandleJob(func(job roboteco.Job) error {
		var r reminder
		if err := job.Decode(&r); err != nil {
			return err
		}
		_, err := roboteco.Messages.Send(r.ChannelID, roboteco.Text("⏰ <@"+r.UserID+">: "+r.Text))
		return err
	})
}
```

The Go SDK mirrors the Rust one:
- **Replies:** `roboteco.Reply(...).WithEmbed(e).WithButtons(...).WithSelect(...)`, `Update`, `ShowModal`.
- **Handlers:** `HandleComponent`, `HandleEvent`, `HandleJob`.
- **Capabilities:** one group per family (`KV`, `Messages`, `Roles`, `Moderation`, `Schedule`, …).
- **Errors:** `*CallError` with a `Code`.

**Try it without Discord**, against the local Postgres and Valkey:

```sh
pnpm plugin check plugin.wasm                  # validates the manifest; lists commands, menus, events, permissions
pnpm plugin run plugin.wasm count              # runs /count and prints the answer (embeds and buttons too)
pnpm plugin click plugin.wasm vote:yes         # clicks the button with id "vote:yes"
pnpm plugin click plugin.wasm color red blue   # picks values in the select with id "color"
pnpm plugin submit plugin.wasm feedback text=hi  # submits the form "feedback"
pnpm plugin event plugin.wasm messageCreate '{"message":{...},"member":null}'
pnpm plugin job plugin.wasm reminder:1 '{"text":"stretch"}'
pnpm plugin run plugin.wasm ban who=123 --perms SendMessages   # as a member without Ban Members
```

The CLI uses a fake member and server (`100000000000000001`) and grants every permission the plugin asks for. By default the caller has every Discord permission; `--perms` narrows it. Discord actions (posting, roles, moderation) need a live bot, and answer `no_server` in the CLI.

**Install it.** The bot loads the plugins listed in `plugins/registry.json`. That list is empty in releases, so the plugins in this repo are examples only. Each entry is `{ "id", "wasm", "permissions" }`, using the permissions `pnpm plugin check` printed. Restart the bot, then run `pnpm deploy-commands`.

**Try the examples** in a test server: set `PLUGIN_REGISTRY=plugins/registry.example.json` in `.env`, then run `pnpm plugins:build`, restart the bot and run `pnpm deploy-commands`. Removing the variable and deploying again takes their commands away. The production image doesn't build plugins (see [production](../operations/production.md)).

## How it works

### Exports

| Export | Called for | Input | Output |
| --- | --- | --- | --- |
| `manifest` | loading | none | the manifest |
| `handle_command` | slash commands and context menus | `Invocation` | `{ actions }` |
| `autocomplete` (optional) | typing in an autocomplete option | `Invocation` with `focused` | `{ choices }`, up to 25 |
| `handle_component` | buttons, select menus, form submits | `Invocation` with `component` | `{ actions }` |
| `handle_event` | subscribed events | `{ event, guildId, channelId, data }` | ignored |
| `handle_job` | runs scheduled with `schedule.create` | `{ key, guildId, channelId, data }` | ignored |

The bot checks at load time that a plugin exports what its manifest needs: `handle_command` for commands or menus, `handle_event` for events, and `handle_job` when it uses `schedule.create`.

### The manifest

```json
{
  "name": "hello", "version": "1.0.0",
  "commands": [{ "name": "hello", "description": "Say hello", "options": [], "defaultMemberPermissions": ["ManageMessages"] }],
  "contextMenus": [{ "type": "user", "name": "Profile" }, { "type": "message", "name": "Quote" }],
  "events": ["messageCreate", "levelUp"],
  "uses": ["kv.increment", "discord.messages.send"],
  "context": ["member", "guild"]
}
```

- **`commands`** are real slash commands. They support typed options (string, integer, number, boolean, user, channel, role), subcommands, choices, ranges, autocomplete, translations, default permissions, and server-only (the default) or DM use. The manifest is checked against Discord's rules before deploy. A command name that clashes with a built-in command or another plugin is refused. `pnpm deploy-commands` registers plugin commands next to the built-in ones, through the core `OnCommandDeploy` hook.
- **`contextMenus`:** up to 5 user and 5 message menus. Discord counts the bot's built-in menus toward that limit.
- **`events`** each need a permission (below).
- **`uses`** lists every capability the plugin calls.
- **`context`** lists what the bot sends with each interaction: the calling `member`, the `guild`, the `channel`. It is built from discord.js's cache, with no API call.

**Default permissions are enforced.** Discord only uses `defaultMemberPermissions` as a default that server admins can override in Integrations. The bot also refuses members who lack those permissions before the plugin runs.

### What a plugin receives

`Invocation` is one shape for commands, menus, autocomplete, buttons, selects and forms:

| Field | |
| --- | --- |
| `kind` | `command`, `autocomplete`, `userMenu`, `messageMenu`, `button`, `select`, `modal` |
| `command`, `subcommand`, `options` | what was typed. Users, roles and channels arrive as IDs |
| `userId`, `guildId`, `channelId`, `locale` | who, where, and their language |
| `permissions` | the caller's permission names in this channel, e.g. `"ManageMessages"` |
| `resolved` | members, roles and channels picked in options or user/role/channel selects, sent by Discord: no lookup needed |
| `context` | what the manifest asked for in `context` |
| `focused` | autocomplete: the option being typed |
| `target` | context menus: the user (and member) or message that was right-clicked |
| `component` | buttons, selects and forms: `id` (the plugin's own), `values` (selects), `fields` (forms), `messageId` |

### What a plugin answers

`{ actions: [...] }`, up to 5:

- **`reply`**: `{ content?, embeds?, components?, ephemeral? }`. The first answers the interaction; the rest are follow-ups.
- **`update`**: the same body without `ephemeral`. Only for buttons, selects and forms opened from a message; it edits the message they're on.
- **`modal`**: `{ id, title, fields: [{ id, label, style: short|paragraph, required, placeholder, value, minLength, maxLength }] }`, up to 5 fields. It must be the only action, and can't answer a form submit.

Discord's limits are checked:
- **Messages:** 2000-character content, up to 10 embeds (6000 characters each).
- **Components:** up to 5 rows. A row holds up to 5 buttons (`primary`, `secondary`, `success`, `danger`, or `link` with a `url`) or one select menu (`string` with up to 25 options, or `user`, `role`, `channel`).
- **Ids:** component ids are the plugin's own, up to 60 characters of `[A-Za-z0-9_:.-]`. The bot prefixes them with the plugin's id (`plg:<plugin>:<id>`) and routes clicks back to the plugin that made them.
- **Mentions** in anything a plugin posts never ping.

If a plugin hasn't answered after 2 seconds (it is busy, or queued behind another call), the bot acknowledges the interaction so Discord doesn't drop it. The plugin's answer then follows as an edit or follow-up. A modal can't be opened after that, so open forms quickly.

### Capabilities

The only host function is `call({ name, input })`. It returns `{ ok: true, value }` or `{ ok: false, error: { code, message } }`, and the SDKs wrap it as typed functions. Every capability is a service method marked with `@Expose`, so a plugin runs the same code as the built-in commands:

```ts
@Expose('moderation.history', {
  permission: 'moderation.read',                 // granted per plugin in plugins/registry.json
  caller: PermissionFlagsBits.ModerateMembers,   // what the member who triggered it must have
  description: "A member's moderation cases in this server, newest first",
  input: z.object({ userId: snowflake, limit: z.number().int().min(1).max(25).default(10) }),
  output: z.object({ total: z.number(), cases: z.array(caseSchema) }),
})
async historyOf(scope: PluginScope, { userId, limit }) { … }
```

| Capability | Permission | Notes |
| --- | --- | --- |
| `kv.get`, `kv.set`, `kv.delete`, `kv.increment`, `kv.list` | `kv` | Postgres, one space per plugin and server. Keys up to 128 bytes, values up to 4 KB, 1000 keys. `increment` is atomic. Keys containing a user's ID are removed when their data is erased |
| `levels.get`, `levels.top` | `levels.read` | the same as `/rank` and `/leaderboard` |
| `xp.grant` | `xp.grant` | to the caller or `userId`. A plugin can give one member at most 100 XP per 10 minutes |
| `discord.member.get`, `discord.roles.list` | `discord.read` | members not in `resolved` or `context` (cache first); roles with whether they grant staff permissions |
| `discord.messages.send`, `discord.messages.edit`, `discord.messages.delete` | `messages.send` | post in a channel of this server (default: the channel of the command, click or event; `memberJoin`, `memberLeave`, `levelUp` and `caseCreated` have none); edit and delete only messages this plugin posted, replies included |
| `discord.messages.remove` | `messages.manage` | delete anyone's message, with an audit log reason. Caller needs Manage Messages |
| `discord.reactions.add` | `reactions` | unicode or custom emoji |
| `discord.dm.send` | `dm.send` | members of this server; 5 per member per plugin per hour |
| `discord.threads.create` | `threads.create` | in a channel, or from a message |
| `discord.roles.add`, `discord.roles.remove` | `roles.manage` | see the rules below |
| `moderation.history` | `moderation.read` | caller needs Moderate Members |
| `moderation.warn`, `timeout`, `untimeout`, `kick`, `ban`, `unban` | `moderation.act` | through `ModerationService`: the same checks, DMs, cases, mod log and escalation as the commands. The case reason names the plugin. For a temporary ban, schedule a `moderation.unban` |
| `schedule.create`, `schedule.cancel`, `schedule.list` | `schedule` | run `handle_job` 10 seconds to a year later, with up to 2 KB of data. A key replaces the earlier run with that key; up to 100 pending per server |
| `log` | none | usable without declaring it |

`pnpm plugin schema` writes `plugins/sdk/schema.json`. It holds the JSON Schema for the manifest, every export's input and output, each event's data, and every capability. It can be used to generate SDKs in other languages.

### Who a plugin acts for

Every call knows its **caller**: the member whose command, click or form triggered it. Events and scheduled runs have no caller.

- **With a caller**, a capability also checks what that member could do:
  - posting needs Send Messages in that channel, and moderation needs the command's permission plus outranking the target;
  - a plugin command can't let someone ban, post in announcements, or read cases unless they could already;
  - refusals come back as `caller_forbidden`, and the message names the missing permission.
- **Without a caller**, the plugin acts with what the server granted it, as the bot. Moderation cases then name the bot as moderator.
- **Roles:**
  - a staff caller can hand out roles below their own highest role;
  - otherwise only roles without staff permissions can be given (no Administrator, Manage, Kick, Ban, Moderate, Mention Everyone and the like);
  - a role at or above the bot's highest role is always refused.

### Events

| Event | Permission | `data` |
| --- | --- | --- |
| `messageCreate` | `events.messages` | `message` (`id`, `channelId`, `authorId`, `content`, `attachments`), `member`. Bots, webhooks and system messages are skipped |
| `memberJoin` | `events.members` | `member` |
| `memberLeave` | `events.members` | `userId`, `username`, `roles` |
| `reactionAdd` | `events.reactions` | `messageId`, `channelId`, `userId`, `emoji` (custom emojis by ID) |
| `levelUp` | `events.levels` | `userId`, `level`, `xp` |
| `caseCreated` | `events.moderation` | `number`, `action`, `targetId`, `moderatorId`, `reason`, `durationSeconds` |

`levelUp` and `caseCreated` come from `DomainEventsService` (`src/modules/domain-events/`): levels and moderation emit them after their own work, without depending on plugins. A plugin acts on events through capabilities; the return value of `handle_event` is ignored.

### Discord events

The events above are shaped by the bot. Any other Discord gateway event can be had as Discord sends it: list it in the manifest's `discordEvents`, and it arrives in `handle_event` with `event` set to Discord's name (`MESSAGE_DELETE`, `GUILD_MEMBER_UPDATE`, `VOICE_STATE_UPDATE`, …). `data` is Discord's own JSON, documented at [Gateway Events](https://discord.com/developers/docs/events/gateway-events), and the SDKs read it with `event.decode::<T>()` (Rust) or `ev.Decode(&v)` (Go).

```json
{ "discordEvents": ["MESSAGE_DELETE", "MESSAGE_REACTION_REMOVE", "VOICE_STATE_UPDATE"] }
```

- **Permissions are Discord's intents.** Each event needs the permission of the intent that delivers it, e.g. `intents.GuildMessages` for `MESSAGE_DELETE`, `intents.GuildVoiceStates` for `VOICE_STATE_UPDATE`, `intents.GuildPresences` for `PRESENCE_UPDATE`. `pnpm plugin check` prints them, and `pnpm plugin schema` lists every event with its permission.
- **The bot requests the intents the registry grants.** Intents are chosen before plugins load, so granting `intents.GuildMessageTyping` to a plugin makes the bot ask Discord for typing events. Privileged intents (`GuildMembers`, `GuildPresences`, `MessageContent`) also need `DISCORD_PRIVILEGED_INTENTS=true` and the switch in the Developer Portal.
- **Message content is its own grant.** Without `intents.MessageContent`, `MESSAGE_CREATE` and `MESSAGE_UPDATE` arrive without `content`, `embeds`, `attachments`, `components` and `poll` (also in the messages they quote), as Discord does for bots without that intent.
- **What's covered:** every guild event in Discord's intents table: server, roles, channels, threads, stage instances, members, bans, the audit log, emojis, stickers, soundboard, integrations, webhooks, invites, voice states and effects, presences, messages, reactions, typing, scheduled events, AutoMod and poll votes.
- **What's not:**
  - `INTERACTION_CREATE` and `VOICE_SERVER_UPDATE` carry tokens that act as the bot;
  - `GUILD_CREATE` is a whole server's state;
  - events outside a server (DMs, the bot's own user) don't belong to one.
- **No loops:** events the bot caused itself (its own messages, its reactions, roles it gave) are not delivered, so a plugin can't trigger itself.
- **Size:** payloads over 64 KB are dropped.
- **Delivery:** like the events above, these are delivered in order per plugin, at most 20 waiting.

### Checks the engine makes

These are made by the engine, so services don't repeat them:
- **Declaration and permissions:**
  - a capability must be in the manifest's `uses`, or the call fails with `not_declared` and a message naming the fix;
  - at load time, everything in `uses` and every subscribed event must be granted in `plugins/registry.json`;
  - a load failure lists every missing permission and what needs it, and misspelled permissions are listed next to the valid ones.
- **Scope:** the server and caller come from the interaction or event, never from the plugin's input.
- **Input** is validated, and an `invalid_input` error names the field. **Output** is cut down to the capability's schema.
- **Rate limit:** 200 calls per 10 seconds per plugin and server (`rate_limited`).
- **Service errors:** services throw `CapabilityError(code, message)` for errors a plugin can handle (`storage_full`, `xp_limit`, `caller_forbidden`, `not_owner`, `refused`, …). Anything else returns `failed` and is logged.
- **Imports:** a plugin that imports anything except `call` is refused. Extism's HTTP functions are the one exception; they need `http` and `allowedHosts`.

### Limits

- 2 seconds per call, plus a watchdog;
- 64 MB of memory;
- no filesystem;
- WASI only for modules that need it (Go).
- **One call at a time:** calls to one plugin are queued, so plugin code never runs concurrently.
- **Events never block commands:** at most 20 events wait per plugin, and further ones are dropped.

### Data and privacy

Plugin storage (`plugin_kv`), the messages plugins posted (`plugin_messages`) and pending runs are deleted when the bot leaves a server. Erasing a user's data deletes the keys that contain their ID.

## Examples

All of these are built with `pnpm plugins:build`.

| Plugin | Shows |
| --- | --- |
| `plugins/hello-rust` | `/hello` with autocomplete; `/count` with a button that updates the message; `/flavor`, a select; `/feedback`, a form; `/profile` and the **Profile** user menu (embeds, `levels.get`); the **Quote** message menu |
| `plugins/coin-go` | `/coin flip call:heads\|tails` with a "Flip again" button, `/coin stats` as an embed: subcommands, choices, KV |
| `plugins/remind-go` | `/nudge` (`schedule.create`, then `handle_job` posts with `discord.messages.send`), a 🏓 reaction on "ping" (`messageCreate`, `discord.reactions.add`), level-up congratulations (`levelUp`, embeds), `/levelup-channel` limited to Manage Server |
| `plugins/fixtures/contract-rust` | The raw JSON contract without an SDK, used by `pnpm test` |
| `plugins/fixtures/evil-rust`, `greedy-rust` | Hostile tests: loops, memory, network, calling capabilities it shouldn't, farming XP |

Tested (`pnpm test`, against the real Postgres and Valkey, with Discord faked):
- every refusal: caller permissions, staff roles, hierarchy, ownership of messages, the XP and DM budgets;
- KV under concurrency (atomic increments, the key limit holding with concurrent writes);
- moderation through plugins and through the commands;
- scheduling.

## What the POC found

- **Extism's JS SDK doesn't cap a plugin's own memory.** `memory.maxPages` only limits Extism's internal allocations, so a plugin could grow to 4 GB. `capMemory` in `src/lib/wasm.ts` rewrites the module's memory section to declare a maximum. It also refuses shared memory, 64-bit memory and imported memory.
- **Timeouts and the HTTP allowlist need `runInWorker`.** It's marked experimental, and after a crash the worker could hang on the next timeout ("Plugin failed to restart during a timeout"). The engine therefore replaces the instance after every failure and puts its own deadline on each call.
- **Go needs WASI** for its runtime. The bot enables WASI only for modules that import it, with no files and no environment variables.

## Next steps

- Install per server with `/plugins install`, an approval prompt for permissions, and modules pinned by hash.
- Signed webhooks for plugins in languages WASM handles badly, using the same contract.
- A TypeScript SDK (via the JS PDK), generated from `plugins/sdk/schema.json`.

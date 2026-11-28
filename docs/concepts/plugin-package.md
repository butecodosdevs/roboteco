# Plugin package

The panel does **not** install plugins: it lists what `plugins/registry.json` holds, turns commands
on and off, and shows usage. Installing is a repository change, with two files:

```sh
pnpm plugins:build              # writes plugins/dist/<id>.wasm from plugins/<id>-go or -rust
```

| Path | What it is |
| --- | --- |
| `plugins/dist/<id>.wasm` | The binary. Gitignored, so it is compiled on every machine. |
| `plugins/registry.json` | One `{ id, wasm, enabled, permissions, allowedHosts? }` entry per plugin. |

```json
{
  "plugins": [
    { "id": "hello", "wasm": "plugins/dist/hello.wasm", "enabled": true, "permissions": ["kv"] }
  ]
}
```

The `id` is the plugin name: lowercase letters, digits and hyphen, up to 32 characters — `hello`,
`daily-xp`, `welcome-2`.

## What the bot does

1. Reads `registry.json` at boot.
2. Loads the `.wasm` of every entry with `enabled: true`.
3. Checks the permissions the WASM imports against the `permissions` list; whatever is missing is
   shown on the panel card.
4. Publishes the commands to Discord (`pnpm deploy-plugins`, or the **Publish to Discord** button in
   the panel).

If the WASM cannot be read, or its commands collide with a built-in or another plugin's, the plugin
does not load and the card shows why. Everything else keeps working.

## What the panel controls, and what it does not

| Action | Where |
| --- | --- |
| Enable or disable a plugin | Panel |
| Turn a single command on or off | Panel |
| Publish commands to Discord | Panel |
| Install, build, remove a plugin | Repository |
| Grant a permission or an allowed host | Repository |

Permissions and hosts are the security boundary for a plugin, so they live in the reviewed
`registry.json`: a change gets a diff and a reviewer. The panel reads them and renders them as text;
a request that carries `permissions` or `allowedHosts` is refused with a 400.

## Updating a version

Rebuild with `pnpm plugins:build`, put the new `.wasm` in `plugins/dist/` and press **Reload** in the
panel. The permissions already granted in the registry stay as they are.

## See also

- [plugins](plugins.md) — the WASM contract, commands and permissions.
- [getting started](../getting-started.md) — scripts, including `pnpm deploy-plugins`.

# Structure rules

## What it is

The project layout is checked by the linter. `pnpm lint` runs two checkers after Biome's normal rules:
- **Per file**: Biome, using `biome-plugins/structure.grit`. Results also show in the editor.
- **Across files**: `scripts/lint-structure.ts`, also available as `pnpm lint:structure`.

Either one fails the run with a `path:line` message.

## What it's for

The architecture only helps while everyone follows it. These rules turn conventions into errors:
- a command that was never registered;
- a module reaching into another module's internals;
- a translation missing for one language;
- a file in the wrong folder.

They are caught before review, by people and AI agents alike.

## How it works

**Naming and placement**

| Decorator | File | Class name |
| --- | --- | --- |
| `@Module` | `modules/<feature>/<feature>.module.ts` | `*Module` |
| `@Injectable` | `modules/<feature>/<name>.service.ts` | `*Service` |
| `@Command` | `commands/<name>/<name>.command.ts` | `*Command` |
| `@Subcommand` | `commands/<name>/<sub>.subcommand.ts` | `*Subcommand` |
| `@UserContextMenu` / `@MessageContextMenu` | `context-menus/<name>.context-menu.ts` | `*ContextMenu` |
| `@Button` / `@SelectMenu` / `@Modal` | `components/<name>.button.ts` / `.select.ts` / `.modal.ts` | `*Button` / `*Select` / `*Modal` |
| `@On` / `@Once` | `events/<event>.event.ts` | `*Event` |
| `@Job` | `jobs/<name>.job.ts` | `*Job` |

- Each of those files holds exactly one decorated, exported class.
- File names are kebab-case. Locale files (`en-US.ts`) are the exception.
- A module's root holds only `<feature>.module.ts` and services. Everything else goes in `commands/<name>/`, `context-menus/`, `components/`, `events/`, `jobs/` or `i18n/`. Helpers for a single command may sit in its folder.

**Imports**

- `@/*` maps to `src/*` (`tsconfig.json` `paths`). Use it for every import that leaves the current module, or the current top-level folder outside `src/modules/`. Keep imports inside one module relative.
- Imports have no extension (`moduleResolution: "Bundler"`). `tsx` (dev) and the editor resolve them from `tsconfig.json`. `pnpm build` (`scripts/build.ts`) bundles `src/index.ts`, `src/deploy-commands.ts` and `src/db/migrate.ts` with esbuild into `dist/`, leaving `node_modules` packages external, so plain `node` runs the output. `tsc` only typechecks (`noEmit`).
- The structure linter and Biome's `noImportCycles` both resolve `@/` imports, so the boundary and cycle rules still apply.

**Boundaries**

- A module may use another module only through its `*.module.ts` (in `imports`) or its root services (with `inject`).
- Outside `src/modules/`, only `app.module.ts` and `src/i18n/locales/` may import from it. `core`, `db`, `storage` and `i18n` never depend on features.
- No import cycles.

**Completeness**

- Commands, context menus, components, events and jobs are listed in their module, subcommands in their command, and every module is reachable from `AppModule`.
- Every service is injected somewhere.
- A module with commands has an `i18n/` file for every language, each registered in `src/i18n/locales/`.

The cross-file checker reads imports and decorator lists from the text, so keep files formatted with `pnpm format`.

## Example: fixing a failing lint

Suppose `/roll` was written straight into the ping folder and never registered:

```
src/modules/ping/commands/ping/roll.ts:3:1   × @Command() belongs in a *.command.ts file.
src/modules/ping/commands/ping/roll.ts:4:14  × Classes decorated with @Command() must be named *Command.
```

After moving it to `src/modules/ping/commands/roll/roll.command.ts` and renaming the class to `RollCommand`, Biome passes and the cross-file check reports the next problem:

```
src/modules/ping/commands/roll/roll.command.ts:1  RollCommand is not listed in any @Module({ commands }).
```

Adding it to `PingModule`'s `commands` makes `pnpm lint` pass. If `/roll` isn't really about ping, the better fix is its own module ([modules](modules.md#example-a-dice-module-with-roll)).

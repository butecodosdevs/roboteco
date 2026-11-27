# Modules

## What it is

A module is a class decorated with `@Module` that groups everything one feature needs: its slash commands, its event handlers, the Discord intents those require, and a startup hook. Each module lives in its own folder, `src/modules/<feature>/`, together with its services and translations.

`AppModule` (`src/app.module.ts`) is the root. It `imports` the feature modules, and `bootstrap(AppModule)` builds the bot from that tree.

## What it's for

- **One place per feature.** Everything about a feature sits in one folder, so you add it, review it or delete it as a unit.
- **Explicit wiring.** A command or event exists only once a module lists it. Nothing is discovered by scanning folders.
- **Least privilege.** Each module declares only the intents it needs, and the bot requests their union.
- **Boundaries.** Other code can only reach a module through its `*.module.ts` and services (see [structure rules](structure-rules.md)), so internals stay private.

Create a new module for a new feature. Add to an existing module when the change belongs to that feature.

## How it works

```ts
@Module({
  imports: [],       // modules this one depends on
  intents: [],       // GatewayIntentBits; Guilds is always on
  partials: [],      // Partials, to receive events about uncached messages, reactions, members
  commands: [],      // @Command classes
  contextMenus: [],  // @UserContextMenu / @MessageContextMenu classes
  components: [],    // @Button / @SelectMenu / @Modal classes
  events: [],        // @On / @Once classes
  jobs: [],          // @Job classes
})
export class FeatureModule implements OnReady, OnGuildRemove, OnUserErase, OnCommandDeploy {
  onReady(client: Client<true>) {}                    // optional, runs once after login
  onGuildRemove(guildId: string) {}                   // delete this module's server data
  onUserErase(userId: string, guildId?: string) {}    // delete this module's user data
  deployCommands(builtIn: ReadonlySet<string>) {}     // extra slash commands for deploy (plugins)
}
```

`onGuildRemove` and `onUserErase` are described in [the privacy example](../examples/privacy.md). Every module that stores server or user data must implement them.

At startup the bootstrap walks `imports` from `AppModule`, merges the intents, instantiates each command and event once, and calls every `onReady` after login. `pnpm deploy-commands` walks the same tree to register the commands with Discord.

Folder layout:

```
src/modules/<feature>/
  <feature>.module.ts
  <name>.service.ts              optional, see services
  commands/<name>/<name>.command.ts
  context-menus/<name>.context-menu.ts
  components/<name>.button.ts | .select.ts | .modal.ts
  events/<event>.event.ts
  jobs/<name>.job.ts
  i18n/en-US.ts, pt-BR.ts
```

## Example: a `dice` module with `/roll`

**`src/modules/dice/i18n/en-US.ts`**

```ts
export const diceEnUS = {
  command: { name: 'roll', description: 'Roll a die' },
  options: {
    sides: { name: 'sides', description: 'Number of sides (default 6)' },
  },
  result: 'You rolled **{result}** (d{sides}).',
} as const;
```

**`src/modules/dice/i18n/pt-BR.ts`**

```ts
import type { Messages } from '@/i18n/types';

export const dicePtBR: Messages['dice'] = {
  command: { name: 'rolar', description: 'Rola um dado' },
  options: {
    sides: { name: 'lados', description: 'Número de lados (padrão 6)' },
  },
  result: 'Você tirou **{result}** (d{sides}).',
};
```

**`src/modules/dice/commands/roll/roll.command.ts`**

```ts
import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize, translator } from '@/i18n';

@Command({
  data: localize(new SlashCommandBuilder(), 'dice.command').addIntegerOption((opt) =>
    localize(opt, 'dice.options.sides').setMinValue(2).setMaxValue(1000),
  ),
})
export class RollCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const tr = translator(interaction.locale);
    const sides = interaction.options.getInteger('sides') ?? 6;
    const result = 1 + Math.floor(Math.random() * sides);
    return interaction.reply(tr('dice.result', { result, sides }));
  }
}
```

**`src/modules/dice/dice.module.ts`**

```ts
import { Module } from '@/core';
import { RollCommand } from './commands/roll/roll.command';

@Module({ commands: [RollCommand] })
export class DiceModule {}
```

Then wire it in:

1. Register the translations in `src/i18n/locales/en-US.ts` (`dice: diceEnUS`) and `pt-BR.ts` (`dice: dicePtBR`). See [i18n](i18n.md#registering-a-modules-translations).
2. Add `DiceModule` to `imports` in `src/app.module.ts`.
3. Run `pnpm typecheck && pnpm lint`, then `pnpm deploy-commands` and `pnpm dev`.

In the codebase: `src/modules/ping/` is the smallest real module, and [the honeypot example](../examples/honeypot.md) shows a module that uses every feature.

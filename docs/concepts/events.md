# Events

## What it is

An event handler is a class decorated with `@On(event)` (or `@Once(event)`) whose `execute` runs every time Discord reports that event, for example a message posted, a member joining or a channel deleted. `event` is a discord.js `Events` value, and the `execute` parameters are type-checked against that event's payload.

## What it's for

Events let the bot react to things nobody asked it to do: moderation (the honeypot bans on `MessageCreate`), keeping data in sync (clean up when a channel is deleted), or onboarding (greet a server when the bot joins).

Use a [command](commands.md) when a member asks for something. Use an event when the bot should notice something.

## How it works

- Files go in `events/<event>.event.ts` (kebab-case event name), with the class named `*Event`, listed in the module's `events`.
- `@On` fires every time; `@Once` fires only the first time.
- **Intents.** Discord only sends events the bot subscribed to. Add what the module needs to `intents`; `Guilds` is always on.

| Events | Intent | Privileged |
| --- | --- | --- |
| `GuildCreate`, `ChannelDelete`, roles, threads | `Guilds` (always on) | no |
| `MessageCreate` / `MessageUpdate` / `MessageDelete` in servers | `GuildMessages` | no |
| Message text (`message.content`) | `MessageContent` | yes |
| `GuildMemberAdd` / `GuildMemberRemove` | `GuildMembers` | yes |
| `MessageReactionAdd` | `GuildMessageReactions` | no |
| `VoiceStateUpdate` | `GuildVoiceStates` | no |

Privileged intents must be switched on in the Developer Portal (Bot → Privileged Gateway Intents) **and** allowed with `DISCORD_PRIVILEGED_INTENTS=true`. Without that variable, the bootstrap leaves them out, so login doesn't fail, and logs which modules will miss events. `welcome` and `logs` depend on them.

- **Partials.** Events about messages, reactions or members the bot hasn't cached arrive as "partial" objects, and only if the module lists the matching `Partials`. Check `.partial` and call `.fetch()` before reading fields. `starboard` does this for reactions on old messages.

- **Keep the common path cheap.** A `MessageCreate` handler runs for every message in every server. Return early on anything you don't handle, and read state from a cached [service](services.md) instead of the database.
- **Errors** are caught and logged per call. They never crash the bot.

## Example: introduce the bot when it joins a server

**`src/modules/intro/events/guild-create.event.ts`**

```ts
import { Events, type Guild } from 'discord.js';
import { On } from '@/core';
import { t } from '@/i18n';

@On(Events.GuildCreate)
export class GuildCreateEvent {
  async execute(guild: Guild) {
    await guild.systemChannel?.send(t(guild.preferredLocale, 'intro.message')).catch(() => {});
  }
}
```

**`src/modules/intro/i18n/en-US.ts`**

```ts
export const introEnUS = {
  message: "Hi, I'm roboteco! Type `/` to see what I can do.",
} as const;
```

**`src/modules/intro/i18n/pt-BR.ts`**

```ts
import type { Messages } from '@/i18n/types';

export const introPtBR: Messages['intro'] = {
  message: 'Oi, eu sou o roboteco! Digite `/` para ver o que eu sei fazer.',
};
```

**`src/modules/intro/intro.module.ts`**

```ts
import { Module } from '@/core';
import { GuildCreateEvent } from './events/guild-create.event';

@Module({ events: [GuildCreateEvent] })
export class IntroModule {}
```

A few details:
- The message is posted in the **server's** language (`guild.preferredLocale`), because nobody triggered it.
- `systemChannel` may be unset, and the bot may lack permission there, so both cases are ignored instead of failing.
- `GuildCreate` only needs `Guilds`, so the module declares no intents. For message events it would declare `intents: [GatewayIntentBits.GuildMessages]`, as `HoneypotModule` does.

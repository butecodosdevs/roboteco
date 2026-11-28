# Commands

## What it is

A command is a class decorated with `@Command` that defines one Discord slash command (`/roll`, `/announce`) and handles its calls. The decorator holds the command's definition (name, description, options, permissions). The class's `execute(interaction)` method runs each time someone uses the command.

## What it's for

Slash commands are how members ask the bot to do something. Discord shows them in the `/` menu with autocomplete, validates option types before the bot sees them, and translates their names and descriptions into each user's language.

Use a command when a member starts an action. Use an [event](events.md) when the bot should react to something that happens anyway. Use [subcommands](subcommands.md) when several related actions belong under one name.

## How it works

| `@Command` option | Purpose |
| --- | --- |
| `data` | A `SlashCommandBuilder`. Set its name, description and options with `localize` ([i18n](i18n.md)) |
| `guildOnly` | Discord offers the command only inside servers. `execute` receives a `GuildInteraction` with `guild` and `member` available |
| `subcommands` | Sends each call to a [subcommand](subcommands.md) class instead of `execute` |

- **Options are read by their en-US name.** `interaction.options.getString('message')` works whatever the user's language, because Discord always sends the en-US name. Those `name` keys are identifiers, so don't change them casually.
- **Permissions.** `.setDefaultMemberPermissions(PermissionFlagsBits.X)` hides the command from members without that permission. Server admins can open a command to other roles in Server Settings → Integrations, so the framework also checks the permission before `execute` or `autocomplete` runs, for commands and context menus alike. A member without it gets a private reply naming what's missing, and autocomplete gets no suggestions. An override can still hide a command from members who have the permission; it can't open it to members who don't. Checks about something else, like letting authors delete their own tags, stay in the handler.
- **Replies.** Every interaction must be answered within 3 seconds:
  - `reply` for quick answers;
  - `deferReply` then `editReply` for anything slower;
  - `flags: MessageFlags.Ephemeral` so only the caller sees the reply.
- **Errors.** Anything thrown is logged, and the user gets a translated "something went wrong" reply.
- Commands live in `commands/<name>/<name>.command.ts`, are listed in the module's `commands`, and reach Discord only after `pnpm deploy-commands`.

## Cooldowns

`cooldown: seconds` on `@Command` (or the second argument of `@Subcommand` and of the context menu decorators) limits each member to one use per period. Further uses get a translated "you can use this again in …" reply instead of running `execute`. Use it on anything that posts publicly or writes data:
- `/suggest`: 60s;
- `/remind`: 10s;
- `/tag add`: `@Subcommand(data, { cooldown: 10 })`;
- the report context menus: 30s.

Cooldowns are kept in memory, so they reset on restart.

## Autocomplete

Options marked with `.setAutocomplete(true)` get suggestions as the user types. Add an `autocomplete(interaction)` method to the command or subcommand class. It must call `interaction.respond` with at most 25 `{ name, value }` choices, within 3 seconds:

```ts
async autocomplete(interaction: GuildAutocompleteInteraction) {
  const names = await this.tags.search(interaction.guildId, interaction.options.getFocused());
  return interaction.respond(names.map((name) => ({ name, value: name })));
}
```

The user can still submit any value, so `execute` must validate it. `/tag show` and `/tag delete` (`src/modules/tags`) use this.

## Example: `/announce`, a server-only command for moderators

It posts a message to a channel as the bot. It shows a guild-only command, a permission gate, typed options, a deferred ephemeral reply and safe mentions.

**`src/modules/announcements/commands/announce/announce.command.ts`**

```ts
import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command, type GuildInteraction } from '@/core';
import { localize, translator } from '@/i18n';

const channelTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement] as const;

@Command({
  data: localize(new SlashCommandBuilder(), 'announcements.command')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      localize(opt, 'announcements.options.channel')
        .addChannelTypes(...channelTypes)
        .setRequired(true),
    )
    .addStringOption((opt) =>
      localize(opt, 'announcements.options.message').setRequired(true).setMaxLength(2000),
    ),
  guildOnly: true,
})
export class AnnounceCommand {
  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const channel = interaction.options.getChannel('channel', true, [...channelTypes]);
    const message = interaction.options.getString('message', true);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sent = await channel
      .send({ content: message, allowedMentions: { parse: [] } })
      .then(() => true)
      .catch(() => false);

    const key = sent ? 'announcements.replies.sent' : 'announcements.replies.failed';
    return interaction.editReply(tr(key, { channel: channel.toString() }));
  }
}
```

**`src/modules/announcements/i18n/en-US.ts`**

```ts
export const announcementsEnUS = {
  command: { name: 'announce', description: 'Post a message as the bot' },
  options: {
    channel: { name: 'channel', description: 'Where to post' },
    message: { name: 'message', description: 'What to post' },
  },
  replies: {
    sent: 'Posted in {channel}.',
    failed: "I couldn't post in {channel}. Check my permissions there.",
  },
} as const;
```

**`src/modules/announcements/i18n/pt-BR.ts`**

```ts
import type { Messages } from '@/i18n/types';

export const announcementsPtBR: Messages['announcements'] = {
  command: { name: 'anunciar', description: 'Posta uma mensagem como o bot' },
  options: {
    channel: { name: 'canal', description: 'Onde postar' },
    message: { name: 'mensagem', description: 'O que postar' },
  },
  replies: {
    sent: 'Postado em {channel}.',
    failed: 'Não consegui postar em {channel}. Verifique minhas permissões lá.',
  },
};
```

**`src/modules/announcements/announcements.module.ts`**

```ts
import { Module } from '@/core';
import { AnnounceCommand } from './commands/announce/announce.command';

@Module({ commands: [AnnounceCommand] })
export class AnnouncementsModule {}
```

Register the translations and the module as in [modules](modules.md#example-a-dice-module-with-roll), then run `pnpm deploy-commands`.

Why the details matter:
- `allowedMentions: { parse: [] }` stops the bot from pinging `@everyone` on a moderator's behalf.
- `deferReply` covers a slow channel, and Discord accepts no reply after 3 seconds.
- The `.catch` turns a missing permission into a clear message instead of a generic error.

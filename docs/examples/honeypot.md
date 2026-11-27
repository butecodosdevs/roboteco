# Example: the honeypot module

The honeypot is the first real feature in this repository, and a complete example of how the concepts fit together. Code: `src/modules/honeypot/`.

## What it does

Moderators pick a trap channel. Spam bots post everywhere, so anyone who writes there is banned automatically, and their recent messages can be deleted. The bot posts a warning in the channel so humans stay out.

| Command | Effect |
| --- | --- |
| `/honeypot set channel [delete_messages]` | Enables the trap and posts the warning. `delete_messages` is none, last hour (default), 24 hours or 7 days |
| `/honeypot status` | Shows the current setting |
| `/honeypot disable` | Turns it off |

Bots, webhooks and members with Manage Server are never banned. Members ranked above the bot are only logged. The bot needs View Channels, Send Messages and Ban Members.

## How it uses each concept

```
honeypot/
  honeypot.module.ts                 module: intents, command, events, onReady
  honeypot.service.ts                service: cached settings + database
  commands/honeypot/
    honeypot.command.ts              command with subcommands, guildOnly, Manage Server
    set.subcommand.ts                options, choices, permission check, channel post
    status.subcommand.ts
    disable.subcommand.ts
    delete-windows.ts                helper shared by set and status
  events/
    message-create.event.ts          the ban
    channel-delete.event.ts          cleanup
  i18n/en-US.ts, pt-BR.ts
```

| Concept | In the honeypot |
| --- | --- |
| [Module](../concepts/modules.md) | `HoneypotModule` declares `GatewayIntentBits.GuildMessages` (needed for `MessageCreate`), the command and both events, and loads settings in `onReady` |
| [Command](../concepts/commands.md) | `HoneypotCommand` is `guildOnly` and hidden behind `ManageGuild` with `setDefaultMemberPermissions` |
| [Subcommands](../concepts/subcommands.md) | `set`, `status` and `disable`, one file each. `set` refuses to run without the Ban Members permission |
| [Events](../concepts/events.md) | `MessageCreateEvent` returns early for anything not in a trap channel, so the common path never touches the database. `ChannelDeleteEvent` disables a trap whose channel was deleted |
| [Service](../concepts/services.md) | `HoneypotService` is the cached-service variation: `load()` at startup, `get()` from memory, `set()`/`clear()` write the database and then the cache |
| [Database](../concepts/database.md) | Settings are columns on `guilds` (`honeypot_channel_id`, `honeypot_delete_message_seconds`), written with an upsert. Migration `drizzle/0001_honeypot.sql` |
| [i18n](../concepts/i18n.md) | Replies use `interaction.locale`. The channel warning and the audit-log ban reason use `guild.preferredLocale`. Choices are localized with `localizations()` |

## The flow when a spam bot posts

1. Discord delivers `MessageCreate`, because the module asked for `GuildMessages`.
2. `MessageCreateEvent` skips bots, webhooks and system messages, then reads the trap channel from `HoneypotService` (memory only).
3. Same channel: it fetches the member, skips moderators and members it can't ban, and calls `guild.members.ban` with the configured deletion window and a translated reason.
4. With a window of "none", it deletes the triggering message itself.
5. It records the ban as a moderation case through `ModerationService.recordAutomatic`, so it appears in `/history` and the moderation log ([moderation example](moderation.md)). A module using another module's service is the allowed way to share across modules.

Copy its shape for any feature that needs settings plus a reaction to events.

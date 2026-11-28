# Example: the moderation module

Moderators act on members with slash commands. Every action becomes a numbered **case** that can be looked up later, and is posted to a moderation log channel. Code: `src/modules/moderation/`.

## What it does

| Command | Default permission | Effect |
| --- | --- | --- |
| `/warn user reason` | Moderate Members | Records a warning |
| `/timeout user duration [reason]` | Moderate Members | Discord timeout: 60s, 5m, 10m, 1h, 1d or 1w |
| `/untimeout user [reason]` | Moderate Members | Removes a timeout |
| `/kick user [reason]` | Kick Members | Removes the member |
| `/ban user [reason] [delete_messages] [duration]` | Ban Members | Works for non-members too (paste their ID). Optionally deletes the last hour, day or week of their messages. With `duration` (1h–30d) a job unbans them and records an *Unban* case; `/unban` cancels that job |
| `/unban user [reason]` | Ban Members | Lifts a ban |
| `/purge count [user]` | Manage Messages | Bulk-deletes up to 100 recent messages in the channel, optionally from one user. Discord can't bulk-delete messages older than 14 days |
| `/case view case`, `/case reason case reason` | Moderate Members | Shows a case. Changing the reason also edits the original log message |
| `/history user` | Moderate Members | The user's 10 most recent cases, with the total count |
| `/moderation log cases [channel]`, `/moderation dm enabled`, `/moderation status` | Manage Server | Sets or clears the moderation log channel, chooses whether users get a DM, shows the settings |
| `/moderation escalation warnings [action] [duration]` | Manage Server | Every Nth active warning applies a timeout (default 1h), kick or ban automatically, as a case by the bot. `0` disables |
| `/moderation warn-expiry days` | Manage Server | Warnings older than this stop counting for escalation (default 30; `0` = forever) |
| Right-click a member → *Warn* / *Timeout* | Moderate Members | Opens a form for the reason (and duration, e.g. `10m`), then runs the same flow as the slash commands |

Every action command:
1. **Refuses** to act on yourself, the bot, the server owner, or anyone whose highest role is equal to or above yours or the bot's. It also checks that the bot has the needed permission, and gives a specific reason when it refuses.
2. **DMs the user** in the server's language, with the reason, when DMs are enabled (the default). Kicks and bans DM *before* acting, because the bot can't reach someone after they leave. If the DM fails, the moderator is told.
3. **Records the case and posts it to the log**, then replies to the moderator privately (only they see it).
4. Writes the audit-log reason as `moderator#tag: reason`.

The honeypot's automatic bans become cases too, with the bot as moderator.

## How it uses the concepts

```
moderation/
  moderation.module.ts
  moderation.service.ts            checks → DM → action → case → log, shared by every action command
  cases.service.ts                 case numbers and queries; timeout durations
  mod-log.service.ts               log embeds: post, edit, purge entries
  moderation-settings.service.ts   log channel + DM setting on guilds
  commands/
    warn/ timeout/ untimeout/ kick/ ban/ unban/   one small command each
    purge/
    case/          case.command.ts + view/reason subcommands
    history/
    moderation/    settings: log/dm/status subcommands
  i18n/en-US.ts, pt-BR.ts
```

| Concept | In moderation |
| --- | --- |
| [Commands](../concepts/commands.md) | Each action is its own top-level command, so each can have its own default permission (`setDefaultMemberPermissions`) |
| [Subcommands](../concepts/subcommands.md) | `/case` and `/moderation` group related actions under one permission |
| [Services](../concepts/services.md) | `ModerationService.apply` holds the common flow. An action command only supplies its own check and the Discord call: |
| [Database](../concepts/database.md) | `moderation_cases` table, plus `moderation_log_channel_id`, `moderation_dm_users` and `moderation_case_count` on `guilds`. Migration `drizzle/0002_moderation.sql` |
| [i18n](../concepts/i18n.md) | Replies use the moderator's language. DMs and log embeds use the server's language. Durations and deletion windows are localized choices |

```ts
@Command({ data: /* user, duration, reason options */, guildOnly: true })
export class TimeoutCommand {
  private readonly moderation = inject(ModerationService);

  execute(interaction: GuildInteraction) {
    const target = interaction.options.getUser('user', true);
    const seconds = timeoutDurations[interaction.options.getString('duration', true) as TimeoutDuration];
    return this.moderation.apply(interaction, {
      action: 'timeout',
      target,
      reason: interaction.options.getString('reason'),
      durationSeconds: seconds,
      requireMember: true,
      check: (member) =>
        member?.moderatable ? undefined : { key: 'moderation.errors.cannotTimeout', vars: { user: target.toString() } },
      run: async ({ member, auditReason }) => {
        await member?.timeout(seconds * 1000, auditReason);
      },
    });
  }
}
```

## Case numbers

Cases are numbered per server (#1, #2, …). The number comes from `guilds.moderation_case_count`, incremented with a single `INSERT … ON CONFLICT DO UPDATE … RETURNING` inside the same transaction that inserts the case. Two moderators acting at once can never get the same number. A test with five simultaneous cases confirmed this.

## Adding an action

1. Add the action to `moderationActions` in `src/db/schema.ts`.
2. Add its entry to `requiredPermission` in `moderation.service.ts`, a log colour in `mod-log.service.ts`, and its `actions.*` and `dm.*` translations.
3. Create `commands/<action>/<action>.command.ts` calling `moderation.apply`, and list it in `ModerationModule`.
4. Run `pnpm typecheck && pnpm lint`, then `pnpm deploy-commands`.

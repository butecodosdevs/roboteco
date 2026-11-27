# Context menus

## What it is

A context menu command appears when you right-click (or long-press) a **user** or a **message**, under *Apps*. It's a class decorated with `@UserContextMenu(data)` or `@MessageContextMenu(data)`, whose `execute` receives the clicked user or message.

## What it's for

Use it for actions on something you're looking at, with no IDs to copy: report this message, time out this member, save this message as a tag. A slash command is better when the target isn't on screen or needs several options.

## How it works

- Files go in `context-menus/<name>.context-menu.ts`, with the class named `*ContextMenu` and listed in the module's `contextMenus`.
- Build `data` with `localizeName(new ContextMenuCommandBuilder(), key)`. Context menus have a name but no description. Unlike slash commands, the name may contain spaces and capitals ("Report message").
- They only work in servers. `execute` receives a `GuildUserContextInteraction` (`targetUser`, `targetMember`) or a `GuildMessageContextInteraction` (`targetMessage`).
- Discord allows 5 user and 5 message context menus per bot.
- `pnpm deploy-commands` uploads them along with the slash commands.

## Example: report a message

**`src/modules/reports/context-menus/report-message.context-menu.ts`**

```ts
@MessageContextMenu(localizeName(new ContextMenuCommandBuilder(), 'reports.menus.message'))
export class ReportMessageContextMenu {
  async execute(interaction: GuildMessageContextInteraction) {
    const message = interaction.targetMessage;
    if (message.author.id === interaction.user.id) {
      return interaction.reply({ content: t(interaction.locale, 'reports.replies.self'), flags: MessageFlags.Ephemeral });
    }
    return interaction.showModal(reportModal(interaction.locale, 'message', message.channelId, message.id));
  }
}
```

The menu opens a [modal](components.md#example-a-modal) whose submission creates the report.

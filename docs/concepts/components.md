# Components: buttons, select menus and modals

## What it is

Components are the interactive parts of a message. They're handled by classes:
- **Buttons**, with `@Button(id)`;
- **Select menus**, with `@SelectMenu(id)`;
- **Modals**, the pop-up forms, with `@Modal(id)`.

Every component carries a `customId`. The framework reads the first part of the `customId` to find the class, and passes the rest to `execute(interaction, args)` as string arguments.

## What it's for

Components let members act without typing a command:
- voting on a suggestion;
- picking roles from a menu;
- opening a support ticket;
- filling in a report form.

They also keep state in the message itself. `suggestions.vote:12:up` already says which suggestion and which vote, so no lookup table is needed.

## How it works

- Files go in `components/<name>.button.ts`, `.select.ts` or `.modal.ts`, with classes named `*Button`, `*Select` or `*Modal`. They are listed in the module's `components`.
- The id is a dotted string unique across the bot (`<module>.<action>`) and must not contain `:`.
- Build ids with `customId(Class, ...args)`. It joins them with `:` and rejects anything over Discord's 100-character limit.
- Components only work in servers. The interaction types are `GuildButtonInteraction`, `GuildSelectInteraction` and `GuildModalInteraction`.
- **Answer within 3 seconds**, with one of:
  - `update()` to change the message the component is on;
  - `reply()` to send a new message (often ephemeral);
  - `deferUpdate()` to acknowledge without changing anything;
  - `showModal()` to open a form. This works from commands, context menus and buttons.
- **Old ids.** Components keep working after a restart, because their state is in the id. If no class matches an id, for example after a component was removed, the user gets `errors.componentExpired`.
- **Permissions.** Anyone who can see a message can press its buttons. Check `interaction.memberPermissions` yourself for staff-only actions (`ReportActionButton` does this).
- **Rendering.** Put the function that builds the message, such as `renderSuggestion` or `renderReport`, in the component's file and export it. Both the command that posts the message and the component that updates it use that function, so the two never drift apart.

## Example: a vote button

**`src/modules/suggestions/components/vote.button.ts`** (shortened):

```ts
@Button('suggestions.vote')
export class VoteButton {
  private readonly suggestions = inject(SuggestionsService);

  async execute(interaction: GuildButtonInteraction, [id, direction]: string[]) {
    const suggestion = await this.suggestions.get(interaction.guildId, Number(id));
    if (suggestion?.status !== 'pending') return interaction.deferUpdate();
    const votes = await this.suggestions.vote(suggestion.id, interaction.user.id, direction === 'up' ? 1 : -1);
    return interaction.update(await renderSuggestion(interaction.guild, suggestion, votes));
  }
}
```

The button it handles:

```ts
new ButtonBuilder()
  .setCustomId(customId(VoteButton, suggestion.id, 'up'))   // "suggestions.vote:12:up"
  .setStyle(ButtonStyle.Success)
  .setEmoji('👍')
  .setLabel(String(votes.up));
```

## Example: a modal

```ts
export function reportModal(locale: string, ...target: string[]) {
  return new ModalBuilder()
    .setCustomId(customId(ReportModal, ...target))
    .setTitle(t(locale, 'reports.modal.title'))
    .addComponents(/* a TextInputBuilder with customId 'reason' */);
}

@Modal('reports.submit')
export class ReportModal {
  async execute(interaction: GuildModalInteraction, [kind, ...ids]: string[]) {
    const reason = interaction.fields.getTextInputValue('reason');
  }
}
```

Real uses: `src/modules/suggestions` (votes), `roles` (select menu), `reports` (modal and buttons), `tickets` (open and close buttons).

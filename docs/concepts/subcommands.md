# Subcommands

## What it is

A subcommand is one action under a parent command, such as `/tag add` and `/tag show`. Each is a class decorated with `@Subcommand` that has its own options and its own `execute`. The parent `@Command` lists them and has no `execute` of its own.

## What it's for

- **One name per feature.** Members find related actions together in the `/` menu (`/tag …`) instead of several unrelated commands.
- **One file per action.** Each action keeps its own options and logic, so files stay small and changes stay local.
- **Shared settings.** Permissions and `guildOnly` set on the parent apply to every subcommand.

Use subcommands when a feature has several actions on the same thing. Keep a plain [command](commands.md) when there is one action.

## How it works

- The parent: `@Command({ data, guildOnly?, subcommands: [AddSubcommand, ShowSubcommand] })` on an empty class.
- Each subcommand: `@Subcommand(localize(new SlashCommandSubcommandBuilder(), '<module>.<sub>'))`, in `commands/<name>/<sub>.subcommand.ts`.
- Discord sends the subcommand name, and the framework calls that class's `execute`.
- If subcommands take a `GuildInteraction`, the parent must be `guildOnly: true`. Typecheck rejects anything else.
- Helpers used only by this command's subcommands can live in the same folder.

## Example: `/tag add` and `/tag show`

This is a simplified version of the real `src/modules/tags/`, which also has `/tag list`, `/tag delete` and autocomplete.

A tag is a saved text snippet for a server (for example `/tag show rules`). The data is stored by `TagsService`, which is built in [services](services.md#example-tagsservice) on the `tags` table from [database](database.md#example-a-tags-table). Its translations are in [i18n](i18n.md#example-translating-the-tags-module).

**`src/modules/tags/commands/tag/tag.command.ts`**

```ts
import { SlashCommandBuilder } from 'discord.js';
import { Command } from '@/core';
import { localize } from '@/i18n';
import { AddSubcommand } from './add.subcommand';
import { ShowSubcommand } from './show.subcommand';

@Command({
  data: localize(new SlashCommandBuilder(), 'tags.command'),
  guildOnly: true,
  subcommands: [AddSubcommand, ShowSubcommand],
})
export class TagCommand {}
```

**`src/modules/tags/commands/tag/add.subcommand.ts`**

```ts
import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { TagsService } from '../../tags.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tags.add')
    .addStringOption((opt) => localize(opt, 'tags.options.name').setRequired(true).setMaxLength(32))
    .addStringOption((opt) =>
      localize(opt, 'tags.options.content').setRequired(true).setMaxLength(2000),
    ),
)
export class AddSubcommand {
  private readonly tags = inject(TagsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const name = interaction.options.getString('name', true).toLowerCase();
    const content = interaction.options.getString('content', true);

    const saved = await this.tags.add(interaction.guildId, name, content, interaction.user.id);
    return interaction.reply({
      content: tr(saved ? 'tags.replies.saved' : 'tags.replies.exists', { name }),
      flags: MessageFlags.Ephemeral,
    });
  }
}
```

**`src/modules/tags/commands/tag/show.subcommand.ts`**

```ts
import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, translator } from '@/i18n';
import { TagsService } from '../../tags.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'tags.show').addStringOption((opt) =>
    localize(opt, 'tags.options.name').setRequired(true),
  ),
)
export class ShowSubcommand {
  private readonly tags = inject(TagsService);

  async execute(interaction: GuildInteraction) {
    const name = interaction.options.getString('name', true).toLowerCase();
    const content = await this.tags.find(interaction.guildId, name);
    if (!content) {
      return interaction.reply({
        content: translator(interaction.locale)('tags.replies.notFound', { name }),
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.reply({ content, allowedMentions: { parse: [] } });
  }
}
```

**`src/modules/tags/tags.module.ts`**

```ts
import { Module } from '@/core';
import { TagCommand } from './commands/tag/tag.command';

@Module({ commands: [TagCommand] })
export class TagsModule {}
```

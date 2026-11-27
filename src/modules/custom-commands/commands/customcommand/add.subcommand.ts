import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, isBuiltInCommand, Subcommand } from '@/core';
import { localize, t, translator } from '@/i18n';
import {
  CustomCommandsService,
  maxCustomCommands,
  namePattern,
} from '../../custom-commands.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'customCommands.add')
    .addStringOption((opt) =>
      localize(opt, 'customCommands.options.name').setRequired(true).setMaxLength(32),
    )
    .addStringOption((opt) =>
      localize(opt, 'customCommands.options.response').setRequired(true).setMaxLength(2000),
    )
    .addStringOption((opt) =>
      localize(opt, 'customCommands.options.description').setMaxLength(100),
    ),
  { cooldown: 5 },
)
export class AddSubcommand {
  private readonly commands = inject(CustomCommandsService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) => interaction.editReply(content);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const name = interaction.options.getString('name', true).toLowerCase();
    if (!namePattern.test(name)) return reply(tr('customCommands.replies.invalidName'));

    if (isBuiltInCommand(name)) return reply(tr('customCommands.replies.reserved', { name }));
    const existing = await this.commands.get(interaction.guildId, name);
    if (!existing && (await this.commands.count(interaction.guildId)) >= maxCustomCommands) {
      return reply(tr('customCommands.replies.tooMany', { max: maxCustomCommands }));
    }

    await this.commands.save(
      interaction.guild,
      name,
      interaction.options.getString('response', true),
      interaction.options.getString('description') ??
        t(interaction.guild.preferredLocale, 'customCommands.defaultDescription'),
      interaction.user.id,
    );
    return reply(tr('customCommands.replies.saved', { name }));
  }
}

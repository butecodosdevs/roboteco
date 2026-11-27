import { Events, type Interaction } from 'discord.js';
import { inject, On } from '@/core';
import { CustomCommandsService } from '../custom-commands.service';

@On(Events.InteractionCreate)
export class InteractionCreateEvent {
  private readonly commands = inject(CustomCommandsService);

  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;
    if (interaction.commandGuildId !== interaction.guildId) return;
    const custom = await this.commands.get(interaction.guildId, interaction.commandName);
    if (!custom || custom.commandId !== interaction.commandId) return;
    await interaction.reply({ content: custom.response, allowedMentions: { parse: [] } });
  }
}

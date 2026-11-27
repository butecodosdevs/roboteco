import { MessageFlags, PermissionFlagsBits, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t, translator } from '@/i18n';
import { AutomodService } from '../../automod.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'automod.spam'))
export class SpamSubcommand {
  private readonly automod = inject(AutomodService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) => interaction.editReply(content);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return reply(tr('automod.replies.botPermission'));
    }
    const options = {};
    const result = await this.automod.create(interaction.guild, 'spam', options);
    return reply(
      result === 'created'
        ? tr('automod.replies.created', {
            name: t(interaction.guild.preferredLocale, 'automod.ruleNames.spam'),
          })
        : tr(`automod.replies.${result}`),
    );
  }
}

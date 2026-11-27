import { MessageFlags, PermissionFlagsBits, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t, translator } from '@/i18n';
import { AutomodService } from '../../automod.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'automod.mentions')
    .addIntegerOption((opt) =>
      localize(opt, 'automod.options.limit').setMinValue(1).setMaxValue(50),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'automod.options.timeout').setMinValue(1).setMaxValue(40_320),
    ),
)
export class MentionsSubcommand {
  private readonly automod = inject(AutomodService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) => interaction.editReply(content);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return reply(tr('automod.replies.botPermission'));
    }
    const options = {
      limit: interaction.options.getInteger('limit') ?? 5,
      timeoutMinutes: interaction.options.getInteger('timeout') ?? undefined,
    };
    const result = await this.automod.create(interaction.guild, 'mentions', options);
    return reply(
      result === 'created'
        ? tr('automod.replies.created', {
            name: t(interaction.guild.preferredLocale, 'automod.ruleNames.mentions'),
          })
        : tr(`automod.replies.${result}`),
    );
  }
}

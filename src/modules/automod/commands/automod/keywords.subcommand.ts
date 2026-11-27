import { MessageFlags, PermissionFlagsBits, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t, translator } from '@/i18n';
import { AutomodService } from '../../automod.service';

@Subcommand(
  localize(new SlashCommandSubcommandBuilder(), 'automod.keywords')
    .addStringOption((opt) =>
      localize(opt, 'automod.options.words').setRequired(true).setMaxLength(1000),
    )
    .addIntegerOption((opt) =>
      localize(opt, 'automod.options.timeout').setMinValue(1).setMaxValue(40_320),
    ),
)
export class KeywordsSubcommand {
  private readonly automod = inject(AutomodService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) => interaction.editReply(content);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return reply(tr('automod.replies.botPermission'));
    }
    const words = interaction.options
      .getString('words', true)
      .split(',')
      .map((word) => word.trim())
      .filter(Boolean)
      .slice(0, 1000);
    if (words.length === 0) return reply(tr('automod.replies.noWords'));
    const options = {
      words,
      timeoutMinutes: interaction.options.getInteger('timeout') ?? undefined,
    };
    const result = await this.automod.create(interaction.guild, 'keywords', options);
    return reply(
      result === 'created'
        ? tr('automod.replies.created', {
            name: t(interaction.guild.preferredLocale, 'automod.ruleNames.keywords'),
          })
        : tr(`automod.replies.${result}`),
    );
  }
}

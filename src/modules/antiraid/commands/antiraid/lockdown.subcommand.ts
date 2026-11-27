import { MessageFlags, SlashCommandSubcommandBuilder } from 'discord.js';
import { type GuildInteraction, inject, Subcommand } from '@/core';
import { localize, t, translator } from '@/i18n';
import { ModLogService } from '@/modules/moderation/mod-log.service';
import { AntiraidService } from '../../antiraid.service';

@Subcommand(localize(new SlashCommandSubcommandBuilder(), 'antiraid.lockdown'))
export class LockdownSubcommand {
  private readonly antiraid = inject(AntiraidService);
  private readonly log = inject(ModLogService);

  async execute(interaction: GuildInteraction) {
    const tr = translator(interaction.locale);
    const { guild } = interaction;
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    if (!this.antiraid.canLock(guild)) return reply(tr('antiraid.replies.botPermission'));

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const changed = await this.antiraid.lock(guild);
    if (changed) {
      const locale = guild.preferredLocale;
      await this.log.postAlert(
        guild,
        t(locale, 'antiraid.alert.title'),
        t(locale, 'antiraid.alert.manual', { user: interaction.user.toString() }),
      );
    }
    return interaction.editReply(
      tr(changed ? 'antiraid.replies.locked' : 'antiraid.replies.alreadyLocked'),
    );
  }
}

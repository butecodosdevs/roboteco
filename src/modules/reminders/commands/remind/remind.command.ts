import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command, inject, schedule } from '@/core';
import { localize, translator } from '@/i18n';
import { ReminderJob } from '../../jobs/reminder.job';
import { maxReminders, parseDuration, RemindersService } from '../../reminders.service';

@Command({
  data: localize(new SlashCommandBuilder(), 'reminders.remind')
    .addStringOption((opt) =>
      localize(opt, 'reminders.options.when').setRequired(true).setMaxLength(20),
    )
    .addStringOption((opt) =>
      localize(opt, 'reminders.options.text').setRequired(true).setMaxLength(1000),
    ),
  cooldown: 10,
})
export class RemindCommand {
  private readonly reminders = inject(RemindersService);

  async execute(interaction: ChatInputCommandInteraction) {
    const tr = translator(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

    const seconds = parseDuration(interaction.options.getString('in', true));
    if (!seconds) return reply(tr('reminders.replies.invalidTime'));
    if ((await this.reminders.count(interaction.user.id)) >= maxReminders) {
      return reply(tr('reminders.replies.tooMany', { max: maxReminders }));
    }

    const remindAt = new Date(Date.now() + seconds * 1000);
    const reminder = await this.reminders.create({
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      text: interaction.options.getString('text', true),
      remindAt,
    });
    try {
      await this.reminders.setJob(
        reminder.id,
        await schedule(ReminderJob, remindAt, { reminderId: reminder.id }),
      );
    } catch (error) {
      await this.reminders.complete(reminder.id);
      throw error;
    }
    return reply(
      tr('reminders.replies.set', {
        id: reminder.id,
        when: `<t:${Math.floor(remindAt.getTime() / 1000)}:R>`,
      }),
    );
  }
}

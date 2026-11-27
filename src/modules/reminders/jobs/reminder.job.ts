import type { Client } from 'discord.js';
import { inject, Job } from '@/core';
import { t } from '@/i18n';
import { RemindersService } from '../reminders.service';

export interface ReminderPayload {
  reminderId: number;
}

@Job('reminders.deliver')
export class ReminderJob {
  async execute({ reminderId }: ReminderPayload, client: Client<true>) {
    const reminders = inject(RemindersService);
    const reminder = await reminders.get(reminderId);
    if (!reminder) return;

    const guild = reminder.guildId ? client.guilds.cache.get(reminder.guildId) : undefined;
    const locale = guild?.preferredLocale ?? 'en-US';
    const content = t(locale, 'reminders.delivery', {
      user: `<@${reminder.userId}>`,
      text: reminder.text,
    });
    const allowedMentions = { users: [reminder.userId] };

    const channel = reminder.channelId
      ? await client.channels.fetch(reminder.channelId).catch(() => null)
      : null;
    const sent = channel?.isSendable()
      ? await channel
          .send({ content, allowedMentions })
          .then(() => true)
          .catch(() => false)
      : false;
    if (!sent) {
      const user = await client.users.fetch(reminder.userId);
      await user.send({ content, allowedMentions });
    }
    await reminders.complete(reminder.id);
  }
}

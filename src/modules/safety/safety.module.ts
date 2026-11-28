import { GatewayIntentBits } from 'discord.js';
import { ensureScheduled, inject, Module, type OnGuildRemove, type OnReady } from '@/core';
import { SafetyCommand } from './commands/safety/safety.command';
import { MessageCreateEvent } from './events/message-create.event';
import { MessageUpdateEvent } from './events/message-update.event';
import { RecheckJob, recheckIntervalMs } from './jobs/recheck.job';
import { RefreshPhishingListsJob, refreshIntervalMs } from './jobs/refresh-phishing-lists.job';
import { PhishingListService } from './phishing-list.service';
import { RechecksService } from './rechecks.service';

@Module({
  intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  commands: [SafetyCommand],
  events: [MessageCreateEvent, MessageUpdateEvent],
  jobs: [RefreshPhishingListsJob, RecheckJob],
})
export class SafetyModule implements OnReady, OnGuildRemove {
  private readonly rechecks = inject(RechecksService);
  private readonly phishingList = inject(PhishingListService);

  async onReady() {
    // The lists live in memory, so they are downloaded on every start, without holding it up.
    void this.phishingList.refresh();
    await ensureScheduled(RefreshPhishingListsJob, new Date(Date.now() + refreshIntervalMs), {});
    await ensureScheduled(RecheckJob, new Date(Date.now() + recheckIntervalMs), {});
  }

  onGuildRemove(guildId: string) {
    return this.rechecks.forgetGuild(guildId);
  }
}

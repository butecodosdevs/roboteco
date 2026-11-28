import type { Message } from 'discord.js';
import { Injectable, inject } from '@/core';
import { getGuildSettings } from '@/db';
import { RechecksService } from './rechecks.service';
import { RemovalService } from './removal.service';
import { contentsOf, ScanService } from './scan.service';

/** The safety flow for one message: scan it, then remove it or schedule its next recheck. */
@Injectable()
export class SafetyService {
  private readonly scanner = inject(ScanService);
  private readonly removal = inject(RemovalService);
  private readonly rechecks = inject(RechecksService);

  /** `attempt` is null for a message just posted or edited, or the recheck being run. */
  async process(message: Message<true>, attempt: number | null = null): Promise<void> {
    const settings = await getGuildSettings(message.guildId);
    if (!settings?.safetyEnabled) return;

    const contents = contentsOf(message);
    if (contents.links.length === 0 && contents.attachments.length === 0) return;

    const isRecheck = attempt !== null;
    const findings = await this.scanner.scan(contents, isRecheck);
    if (findings.length > 0) {
      await this.removal.remove(message, findings, settings, isRecheck);
      return;
    }

    await this.rechecks.scheduleAfter(message, attempt);
  }
}

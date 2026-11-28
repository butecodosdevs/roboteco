import { createHash } from 'node:crypto';
import type { Attachment, Message } from 'discord.js';
import { config } from '@/config';
import { Injectable, inject } from '@/core';
import { Limiter } from '@/lib/limiter';
import { findLinks } from '@/lib/links';
import { resolveRedirects } from '@/lib/safe-fetch';
import { logger } from '@/logger';
import { AbuseChService } from './abuse-ch.service';
import { ClamavService } from './clamav.service';
import { PhishingListService } from './phishing-list.service';
import { SafeBrowsingService } from './safe-browsing.service';
import {
  isThreat,
  type ScannedFile,
  type Threat,
  type ThreatCheck,
  type ThreatSource,
  ThreatsService,
} from './threats.service';
import { VirusTotalService } from './virus-total.service';

/** The links and attachments a message carries, including those of the messages it forwards. */
export interface MessageContents {
  links: string[];
  attachments: Attachment[];
}

/** A confirmed threat in one link or attachment of a message. */
export interface Finding {
  kind: 'link' | 'file';
  /** The link as posted, or the attachment's file name. */
  target: string;
  /** Where the link redirected to, when the threat was found on a later hop. */
  via?: string;
  threat: Threat;
}

const maxLinks = 10;
const maxAttachments = 10;
// Downloads are held in memory, so only a few run at once.
const maxConcurrentDownloads = 3;

/** At most 10 links and 10 attachments, so one message can't make the bot do unbounded work. */
export function contentsOf(message: Message): MessageContents {
  const forwarded = [...message.messageSnapshots.values()];
  const texts = [
    message.content,
    ...forwarded.map((snapshot) => snapshot.content ?? ''),
    ...message.embeds.map((embed) => embed.url ?? ''),
  ];
  const attachments = [message, ...forwarded].flatMap((m) => [...m.attachments.values()]);

  return {
    links: [...new Set(texts.flatMap(findLinks))].slice(0, maxLinks),
    attachments: attachments.slice(0, maxAttachments),
  };
}

/**
 * Turns a message's contents into findings. Links are checked by the phishing list, Safe Browsing,
 * URLhaus and VirusTotal; files by ClamAV, MalwareBazaar and VirusTotal. VirusTotal comes last
 * because its free budget is the smallest.
 */
@Injectable()
export class ScanService {
  private readonly threats = inject(ThreatsService);
  private readonly phishingList = inject(PhishingListService);
  private readonly safeBrowsing = inject(SafeBrowsingService);
  private readonly abuseCh = inject(AbuseChService);
  private readonly virusTotal = inject(VirusTotalService);
  private readonly clamav = inject(ClamavService);
  private readonly downloads = new Limiter(maxConcurrentDownloads);

  private readonly linkChecks: ThreatCheck<string>[] = [
    this.phishingList,
    this.safeBrowsing,
    this.abuseCh.urls,
    this.virusTotal.urls,
  ];

  private readonly fileChecks: ThreatCheck<ScannedFile>[] = [
    this.clamav,
    this.abuseCh.files,
    this.virusTotal.files,
  ];

  /** Every source once, and whether this bot has it configured. */
  sources(): Map<ThreatSource, boolean> {
    const sources = new Map<ThreatSource, boolean>();
    for (const check of [...this.linkChecks, ...this.fileChecks]) {
      sources.set(check.source, check.enabled);
    }
    return sources;
  }

  /** `fresh` asks the sources again instead of trusting a remembered clean verdict. */
  async scan(contents: MessageContents, fresh: boolean): Promise<Finding[]> {
    const findings = await Promise.all([
      ...contents.links.map((link) => this.scanLink(link, fresh)),
      ...contents.attachments.map((attachment) => this.scanAttachment(attachment, fresh)),
    ]);
    return findings.filter((finding) => finding !== null);
  }

  /** Checks each hop of the link's redirect chain, and stops at the first threat. */
  private async scanLink(link: string, fresh: boolean): Promise<Finding | null> {
    for (const hop of await resolveRedirects(link)) {
      const verdict = await this.threats.verdict(`url:${hop}`, hop, this.linkChecks, fresh);
      if (isThreat(verdict)) {
        return { kind: 'link', target: link, via: hop === link ? undefined : hop, threat: verdict };
      }
    }
    return null;
  }

  private async scanAttachment(attachment: Attachment, fresh: boolean): Promise<Finding | null> {
    if (!this.fileChecks.some((check) => check.enabled)) return null;
    if (attachment.size > config.safety.maxFileBytes) return null;

    const file = await this.downloads
      .run(() => download(attachment))
      .catch((error: unknown) => {
        logger.warn(
          { err: error, attachment: attachment.id },
          'Safety: attachment download failed',
        );
        return null;
      });
    if (!file) return null;

    const verdict = await this.threats.verdict(`file:${file.sha256}`, file, this.fileChecks, fresh);
    return isThreat(verdict) ? { kind: 'file', target: file.name, threat: verdict } : null;
  }
}

/** Reads the attachment from Discord's CDN into memory, refusing more than SAFETY_MAX_FILE_MB. */
async function download(attachment: Attachment): Promise<ScannedFile> {
  const response = await fetch(attachment.url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > config.safety.maxFileBytes) throw new Error('Attachment over SAFETY_MAX_FILE_MB');
    chunks.push(chunk);
  }

  const bytes = Buffer.concat(chunks);
  return {
    name: attachment.name,
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

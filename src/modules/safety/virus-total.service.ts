import { z } from 'zod';
import { cache } from '@/cache';
import { config } from '@/config';
import { Injectable } from '@/core';
import type { ScannedFile, ThreatCheck } from './threats.service';

const api = 'https://www.virustotal.com/api/v3';

const reportReply = z.object({
  data: z.object({
    attributes: z.object({
      last_analysis_stats: z.record(z.string(), z.number()),
      popular_threat_classification: z
        .object({ suggested_threat_label: z.string().optional() })
        .optional(),
    }),
  }),
});

type Report = z.infer<typeof reportReply>['data']['attributes'];
type VirusTotalSettings = NonNullable<typeof config.safety.virusTotal>;

/**
 * VirusTotal lookups of existing reports, through two checks:
 * - `urls`: a link's report;
 * - `files`: a file's report by SHA-256. Files are never uploaded, because VirusTotal's customers
 *   can download uploaded files.
 *
 * A report counts as a threat when at least VIRUSTOTAL_MIN_DETECTIONS engines call it malicious.
 */
@Injectable()
export class VirusTotalService {
  private readonly settings = config.safety.virusTotal;

  readonly urls: ThreatCheck<string> = {
    source: 'virusTotal',
    enabled: this.settings !== undefined,
    confirm: (url) => this.report(`urls/${Buffer.from(url).toString('base64url')}`),
  };

  readonly files: ThreatCheck<ScannedFile> = {
    source: 'virusTotal',
    enabled: this.settings !== undefined,
    confirm: (file) => this.report(`files/${file.sha256}`),
  };

  /** "N/M engines" plus VirusTotal's threat label. Null when there is no report or too few detections. */
  private async report(path: string): Promise<string | null> {
    const settings = this.settings;
    if (!settings) return null;
    await spendRequest(settings);

    const response = await fetch(`${api}/${path}`, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'x-apikey': settings.apiKey, accept: 'application/json' },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`VirusTotal answered HTTP ${response.status}`);

    return describe(
      reportReply.parse(await response.json()).data.attributes,
      settings.minDetections,
    );
  }
}

function describe(report: Report, minDetections: number): string | null {
  const stats = report.last_analysis_stats;
  const malicious = stats.malicious ?? 0;
  if (malicious < minDetections) return null;

  const engines = Object.values(stats).reduce((sum, count) => sum + count, 0);
  const label = report.popular_threat_classification?.suggested_threat_label;
  return [`${malicious}/${engines} engines`, label].filter(Boolean).join(', ');
}

/**
 * Counts one request against the minute and day budgets, and throws once either is spent.
 * Going over the free API's quota gets the key blocked for a while.
 */
async function spendRequest({ perMinute, perDay }: VirusTotalSettings): Promise<void> {
  const now = new Date();
  const minuteKey = `safety:virustotal:minute:${Math.floor(now.getTime() / 60_000)}`;
  const dayKey = `safety:virustotal:day:${now.toISOString().slice(0, 10)}`;
  const replies = await cache
    .multi()
    .incr(minuteKey)
    .expire(minuteKey, 120)
    .incr(dayKey)
    .expire(dayKey, 2 * 86_400)
    .exec();

  const minute = Number(replies?.[0]?.[1] ?? Number.POSITIVE_INFINITY);
  const day = Number(replies?.[2]?.[1] ?? Number.POSITIVE_INFINITY);
  if (minute > perMinute || day > perDay) {
    throw new Error('VirusTotal request budget spent');
  }
}

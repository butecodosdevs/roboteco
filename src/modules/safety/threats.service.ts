import { createHash } from 'node:crypto';
import { cache } from '@/cache';
import { Injectable } from '@/core';
import { logger } from '@/logger';

/** Every source a threat can come from. Also the i18n keys under `safety.sources`. */
export const threatSources = [
  'phishingList',
  'safeBrowsing',
  'urlhaus',
  'malwareBazaar',
  'virusTotal',
  'clamav',
] as const;

export type ThreatSource = (typeof threatSources)[number];

/** A source's confirmation that a subject is malicious, with its own words for what it found. */
export interface Threat {
  source: ThreatSource;
  detail: string;
}

/**
 * What the checks concluded about one subject:
 * - a `Threat`, from the first source that confirmed one;
 * - `clean` when every enabled source answered and none confirmed a threat;
 * - `unknown` when a source could not answer and none confirmed a threat.
 */
export type Verdict = Threat | 'clean' | 'unknown';

export const isThreat = (verdict: Verdict): verdict is Threat => typeof verdict === 'object';

/** An attachment's content, held in memory for the length of one scan. */
export interface ScannedFile {
  name: string;
  bytes: Buffer;
  /** Hex-encoded. Hash lookups use it, and it identifies the file in the verdict cache. */
  sha256: string;
}

/** One source's ability to confirm that a subject (a URL, a file) is malicious. */
export interface ThreatCheck<S> {
  readonly source: ThreatSource;
  readonly enabled: boolean;
  /** The source's detail when it confirms a threat, null when it knows nothing bad. Throws when it can't answer. */
  confirm(subject: S): Promise<string | null>;
}

const threatTtlSeconds = 7 * 86_400;
// Shorter than the first recheck, so a recheck always asks the sources again.
const cleanTtlSeconds = 30 * 60;

const verdictKey = (id: string) =>
  `safety:verdict:${createHash('sha256').update(id).digest('hex')}`;

/** Decides verdicts, and remembers them in Valkey so a subject posted again isn't checked again. */
@Injectable()
export class ThreatsService {
  /**
   * The verdict for `subject`, identified by `id`. A remembered threat always stands. A remembered
   * clean verdict is reused unless `fresh` asks the sources again, as a recheck does.
   */
  async verdict<S>(
    id: string,
    subject: S,
    checks: ThreatCheck<S>[],
    fresh: boolean,
  ): Promise<Verdict> {
    const remembered = await this.remembered(id);
    if (remembered && (isThreat(remembered) || !fresh)) return remembered;

    const verdict = await firstThreat(subject, checks);
    await this.remember(id, verdict);
    return verdict;
  }

  private async remembered(id: string): Promise<Threat | 'clean' | null> {
    const stored = await cache.get(verdictKey(id)).catch(() => null);
    if (!stored) return null;
    if (stored === 'clean') return 'clean';
    try {
      return JSON.parse(stored) as Threat;
    } catch {
      return null;
    }
  }

  /** An unknown verdict is not remembered: the next sighting should ask again. */
  private async remember(id: string, verdict: Verdict): Promise<void> {
    if (verdict === 'unknown') return;
    const [value, ttl] = isThreat(verdict)
      ? [JSON.stringify(verdict), threatTtlSeconds]
      : [verdict, cleanTtlSeconds];
    await cache.set(verdictKey(id), value, 'EX', ttl).catch(() => undefined);
  }
}

/** Asks the enabled checks in order and stops at the first confirmed threat. */
async function firstThreat<S>(subject: S, checks: ThreatCheck<S>[]): Promise<Verdict> {
  let everyoneAnswered = true;

  for (const check of checks) {
    if (!check.enabled) continue;
    try {
      const detail = await check.confirm(subject);
      if (detail) return { source: check.source, detail };
    } catch (error) {
      logger.warn({ err: error, source: check.source }, 'Safety: a check could not answer');
      everyoneAnswered = false;
    }
  }

  return everyoneAnswered ? 'clean' : 'unknown';
}

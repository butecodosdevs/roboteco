import { z } from 'zod';
import { config } from '@/config';
import { Injectable } from '@/core';
import type { ThreatCheck } from './threats.service';

const endpoint = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

const threatTypes = [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE',
  'POTENTIALLY_HARMFUL_APPLICATION',
];

const replySchema = z.object({
  matches: z.array(z.object({ threatType: z.string() })).optional(),
});

/** Google Safe Browsing's Lookup API (v4): the lists behind Chrome's malware and phishing warnings. */
@Injectable()
export class SafeBrowsingService implements ThreatCheck<string> {
  readonly source = 'safeBrowsing';
  readonly enabled = config.safety.safeBrowsingApiKey !== undefined;

  /** The threat type Google lists the URL under. */
  async confirm(url: string): Promise<string | null> {
    const response = await fetch(`${endpoint}?key=${config.safety.safeBrowsingApiKey}`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'roboteco', clientVersion: '1.0' },
        threatInfo: {
          threatTypes,
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
    });
    if (!response.ok) throw new Error(`Safe Browsing answered HTTP ${response.status}`);

    const { matches } = replySchema.parse(await response.json());
    return matches?.[0]?.threatType ?? null;
  }
}

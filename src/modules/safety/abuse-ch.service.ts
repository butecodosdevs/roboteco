import { z } from 'zod';
import { config } from '@/config';
import { Injectable } from '@/core';
import type { ScannedFile, ThreatCheck } from './threats.service';

const urlhausEndpoint = 'https://urlhaus-api.abuse.ch/v1/url/';
const malwareBazaarEndpoint = 'https://mb-api.abuse.ch/api/v1/';

const urlhausReply = z.object({
  query_status: z.string(),
  url_status: z.string().optional(),
  threat: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
});

const malwareBazaarReply = z.object({
  query_status: z.string(),
  data: z
    .array(z.object({ signature: z.string().nullish(), file_type: z.string().nullish() }))
    .nullish(),
});

/**
 * abuse.ch, one API key for two databases of reviewed malware reports:
 * - `urls`: URLhaus, links that deliver malware;
 * - `files`: MalwareBazaar, malware samples looked up by SHA-256.
 */
@Injectable()
export class AbuseChService {
  private readonly enabled = config.safety.abuseChAuthKey !== undefined;

  readonly urls: ThreatCheck<string> = {
    source: 'urlhaus',
    enabled: this.enabled,
    confirm: (url) => this.urlhaus(url),
  };

  readonly files: ThreatCheck<ScannedFile> = {
    source: 'malwareBazaar',
    enabled: this.enabled,
    confirm: (file) => this.malwareBazaar(file.sha256),
  };

  /** The threat and tags of an active URLhaus entry. An offline entry no longer serves anything. */
  private async urlhaus(url: string): Promise<string | null> {
    const reply = urlhausReply.parse(await this.post(urlhausEndpoint, { url }));
    if (reply.query_status === 'no_results') return null;
    if (reply.query_status !== 'ok') throw new Error(`URLhaus answered ${reply.query_status}`);
    if (reply.url_status === 'offline') return null;

    return [reply.threat, ...(reply.tags ?? [])].filter(Boolean).join(', ') || 'malware';
  }

  /** The malware family and file type of a known sample. */
  private async malwareBazaar(sha256: string): Promise<string | null> {
    const reply = malwareBazaarReply.parse(
      await this.post(malwareBazaarEndpoint, { query: 'get_info', hash: sha256 }),
    );
    if (reply.query_status === 'hash_not_found') return null;
    if (reply.query_status !== 'ok') {
      throw new Error(`MalwareBazaar answered ${reply.query_status}`);
    }

    const sample = reply.data?.[0];
    return [sample?.signature, sample?.file_type].filter(Boolean).join(', ') || 'malware';
  }

  private async post(endpoint: string, fields: Record<string, string>): Promise<unknown> {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Auth-Key': config.safety.abuseChAuthKey ?? '' },
      body: new URLSearchParams(fields),
    });
    if (!response.ok) throw new Error(`abuse.ch answered HTTP ${response.status}`);
    return response.json();
  }
}

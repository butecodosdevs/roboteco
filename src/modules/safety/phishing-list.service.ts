import { config } from '@/config';
import { Injectable } from '@/core';
import { safeFetchText } from '@/lib/safe-fetch';
import { logger } from '@/logger';
import type { ThreatCheck } from './threats.service';

const maxListBytes = 16 * 1024 * 1024;

// Platforms where anyone gets a subdomain. A list entry for the whole platform would flag every
// site on it, so only entries for a specific subdomain are trusted there.
const sharedHosts = new Set([
  'blogspot.com',
  'discord.com',
  'discord.gg',
  'discordapp.com',
  'firebaseapp.com',
  'github.io',
  'gitlab.io',
  'glitch.me',
  'google.com',
  'herokuapp.com',
  'netlify.app',
  'onrender.com',
  'pages.dev',
  'repl.co',
  'vercel.app',
  'web.app',
  'workers.dev',
]);

function parseDomains(text: string): string[] {
  let entries: unknown;
  try {
    const json: unknown = JSON.parse(text);
    entries = Array.isArray(json) ? json : (json as { domains?: unknown })?.domains;
  } catch {
    entries = text.split('\n').map((line) => line.split('#')[0]?.trim().split(/\s+/).pop());
  }
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) =>
      entry
        .trim()
        .toLowerCase()
        .replace(/^[a-z]+:\/\//, '')
        .replace(/^\*\./, '')
        .replace(/[/:].*$/, ''),
    )
    .filter((domain) => domain.includes('.') && !sharedHosts.has(domain));
}

/** Community lists of domains used for phishing on Discord, kept in memory. */
@Injectable()
export class PhishingListService implements ThreatCheck<string> {
  readonly source = 'phishingList';
  readonly enabled = config.safety.phishingListUrls.length > 0;
  private domains = new Set<string>();

  get size(): number {
    return this.domains.size;
  }

  /** Downloads every list again. Keeps the previous domains if every download fails. */
  async refresh(): Promise<void> {
    const texts: string[] = [];
    for (const url of config.safety.phishingListUrls) {
      try {
        texts.push(await safeFetchText(url, { maxBytes: maxListBytes }));
      } catch (error) {
        logger.warn({ err: error, url }, 'Safety: phishing list download failed');
      }
    }
    if (texts.length === 0) return;

    this.load(texts);
    logger.info({ domains: this.size, lists: texts.length }, 'Safety: phishing lists loaded');
  }

  /** Replaces the domains with those of the given lists: JSON arrays, `{ domains }` or plain lines. */
  load(texts: string[]): void {
    this.domains = new Set(texts.flatMap(parseDomains));
  }

  /** The listed domain that the URL's host is, or is a subdomain of. */
  async confirm(url: string): Promise<string | null> {
    const parts = new URL(url).hostname.replace(/\.$/, '').split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const candidate = parts.slice(i).join('.');
      if (this.domains.has(candidate)) return candidate;
    }
    return null;
  }
}

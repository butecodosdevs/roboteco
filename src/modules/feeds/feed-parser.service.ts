import { XMLParser } from 'fast-xml-parser';
import { Injectable } from '@/core';
import { safeFetchText } from '@/lib/safe-fetch';

export interface FeedItem {
  id: string;
  title: string;
  link: string;
}

export interface ParsedFeed {
  title: string;
  items: FeedItem[];
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });
const list = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const text = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (value && typeof value === 'object' && '#text' in value) return String(value['#text']).trim();
  return '';
};

@Injectable()
export class FeedParserService {
  async fetch(url: string): Promise<ParsedFeed> {
    return this.parse(await safeFetchText(url));
  }

  parse(xml: string): ParsedFeed {
    const doc = parser.parse(xml);
    if (doc.rss?.channel) {
      const channel = doc.rss.channel;
      return {
        title: text(channel.title) || 'Feed',
        items: list<Record<string, unknown>>(channel.item).map((item) => {
          const link = text(item.link);
          return { id: text(item.guid) || link || text(item.title), title: text(item.title), link };
        }),
      };
    }
    if (doc.feed) {
      return {
        title: text(doc.feed.title) || 'Feed',
        items: list<Record<string, unknown>>(doc.feed.entry).map((entry) => {
          const links = list<Record<string, string>>(entry.link as Record<string, string>);
          const link =
            (links.find((l) => !l['@rel'] || l['@rel'] === 'alternate') ?? links[0])?.['@href'] ??
            '';
          return { id: text(entry.id) || link, title: text(entry.title), link };
        }),
      };
    }
    throw new Error('Not an RSS or Atom feed');
  }
}

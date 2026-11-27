import {
  type GuildTextBasedChannel,
  type Message,
  PermissionsBitField,
  type Webhook,
} from 'discord.js';
import { Injectable } from '@/core';
import { getGuildSettings } from '@/db';

/** Sites Discord previews poorly that embeds.now fixes. Also the i18n keys under `embeds.sites`. */
export const embedSites = [
  'twitter',
  'instagram',
  'tiktok',
  'reddit',
  'spotify',
  'threads',
  'bluesky',
  'pinterest',
  'facebook',
] as const;

export type EmbedSite = (typeof embedSites)[number];

/** Classify a URL host to a supported site, or null. `www.` is ignored; other subdomains are explicit. */
function hostToSite(host: string): EmbedSite | null {
  const h = host.toLowerCase().replace(/^www\./, '');
  if (h === 'twitter.com' || h === 'x.com' || h === 'mobile.twitter.com') return 'twitter';
  if (h === 'instagram.com' || h === 'instagr.am') return 'instagram';
  if (h === 'tiktok.com' || h === 'vm.tiktok.com' || h === 'm.tiktok.com') return 'tiktok';
  if (h === 'reddit.com' || h === 'old.reddit.com' || h === 'redd.it') return 'reddit';
  if (h === 'open.spotify.com' || h === 'spotify.com') return 'spotify';
  if (h === 'threads.net' || h === 'threads.com') return 'threads';
  if (h === 'bsky.app') return 'bluesky';
  if (h === 'pinterest.com' || h === 'pin.it') return 'pinterest';
  if (h === 'facebook.com' || h === 'm.facebook.com' || h === 'fb.watch') return 'facebook';
  return null;
}

const urlPattern = /https?:\/\/[^\s<>]+/gi;
// URLs at the end of a sentence grab trailing punctuation; strip it and keep it in the text.
const trailing = /[.,!?;:)\]}>'"]+$/;
const webhookName = 'roboteco embeds';
const maxContent = 2000;

export interface FixResult {
  changed: boolean;
  content: string;
}

@Injectable()
export class EmbedsService {
  private readonly webhooks = new Map<string, Webhook>();

  /** Rewrites every supported, non-disabled link in `content` to its embeds.now form. */
  fix(content: string, disabled: ReadonlySet<string>): FixResult {
    let changed = false;
    const out = content.replace(urlPattern, (raw) => {
      const tail = trailing.exec(raw)?.[0] ?? '';
      const link = tail ? raw.slice(0, -tail.length) : raw;
      let url: URL;
      try {
        url = new URL(link);
      } catch {
        return raw;
      }
      const site = hostToSite(url.hostname);
      if (!site || disabled.has(site)) return raw;
      changed = true;
      // `www.` is always an alias of the apex; keep meaningful subdomains (vm., open., mobile.).
      const host = url.host.replace(/^www\./i, '');
      return `https://embeds.now/${host}${url.pathname}${url.search}${tail}`;
    });
    return { changed, content: out };
  }

  async process(message: Message<true>): Promise<void> {
    const settings = await getGuildSettings(message.guildId);
    if (!settings?.embedsEnabled) return;
    if (settings.embedsIgnoredChannels.includes(message.channelId)) return;

    const { changed, content } = this.fix(message.content, new Set(settings.embedsDisabledSites));
    if (!changed || content.length > maxContent) return;
    // Reposting through a webhook drops attachments, stickers and polls, so leave those messages alone.
    if (message.attachments.size > 0 || message.stickers.size > 0 || message.poll) return;

    const channel = message.channel;
    const me = message.guild.members.me;
    const perms = me && channel.permissionsFor(me);
    if (
      !perms?.has(PermissionsBitField.Flags.ManageMessages) ||
      !perms.has(PermissionsBitField.Flags.ManageWebhooks)
    ) {
      return;
    }

    const webhook = await this.webhookFor(channel);
    if (!webhook) return;

    const member = message.member;
    const sent = await webhook
      .send({
        content,
        username: (member?.displayName ?? message.author.username).slice(0, 80),
        // Discord's webhook avatar override ignores .webp (the default) and falls back to the
        // blank avatar, so force a PNG.
        avatarURL: (member ?? message.author).displayAvatarURL({ extension: 'png', size: 256 }),
        threadId: channel.isThread() ? channel.id : undefined,
        // The bot posts on a member's behalf, so it never pings anyone.
        allowedMentions: { parse: [] },
      })
      .catch(() => null);
    if (sent) await message.delete().catch(() => undefined);
  }

  private async webhookFor(channel: GuildTextBasedChannel): Promise<Webhook | null> {
    const parent = channel.isThread() ? channel.parent : channel;
    if (!parent || !('fetchWebhooks' in parent)) return null;

    const cached = this.webhooks.get(parent.id);
    if (cached) return cached;

    const mine = (await parent.fetchWebhooks().catch(() => null))?.find(
      (hook) => hook.owner?.id === channel.client.user.id && hook.token !== null,
    );
    const webhook = mine ?? (await parent.createWebhook({ name: webhookName }).catch(() => null));
    if (webhook) this.webhooks.set(parent.id, webhook);
    return webhook;
  }
}

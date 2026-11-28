import {
  DiscordAPIError,
  type GuildTextBasedChannel,
  type Message,
  PermissionsBitField,
  RESTJSONErrorCodes,
  Routes,
  type Webhook,
  type WebhookMessageCreateOptions,
} from 'discord.js';
import { Injectable, inject } from '@/core';
import { getGuildSettings } from '@/db';
import { t } from '@/i18n';
import { LogsService } from '@/modules/logs/logs.service';

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

const urlPattern = /https?:\/\/[^\s<>`]+/gi;
// URLs at the end of a sentence grab trailing punctuation; strip it and keep it in the text.
const trailing = /[.,!?;:)\]}>'"|]+$/;
// Code blocks and inline code are shown as typed, so links inside them are left alone.
const codePattern = /```[\s\S]*?```|`[^`\n]*`/g;
const webhookName = 'roboteco embeds';
const maxContent = 2000;

export interface FixResult {
  changed: boolean;
  content: string;
}

@Injectable()
export class EmbedsService {
  private readonly logs = inject(LogsService);
  private readonly webhooks = new Map<string, Webhook>();

  /**
   * Rewrites every supported link in `content` to its embeds.now form. Links in code
   * and links wrapped in `<>` (the member asked for no preview) are kept as they are.
   */
  fix(content: string): FixResult {
    let changed = false;
    let out = '';
    let last = 0;
    for (const code of content.matchAll(codePattern)) {
      out += this.fixText(content.slice(last, code.index), () => {
        changed = true;
      });
      out += code[0];
      last = code.index + code[0].length;
    }
    out += this.fixText(content.slice(last), () => {
      changed = true;
    });
    return { changed, content: out };
  }

  private fixText(text: string, onChange: () => void): string {
    return text.replace(urlPattern, (raw, offset: number) => {
      if (text[offset - 1] === '<') return raw;
      const tail = trailing.exec(raw)?.[0] ?? '';
      const link = tail ? raw.slice(0, -tail.length) : raw;
      let url: URL;
      try {
        url = new URL(link);
      } catch {
        return raw;
      }
      if (!hostToSite(url.hostname)) return raw;
      onChange();
      // `www.` is always an alias of the apex; keep meaningful subdomains (vm., open., mobile.).
      const host = url.host.replace(/^www\./i, '');
      return `https://embeds.now/${host}${url.pathname}${url.search}${tail}`;
    });
  }

  async process(message: Message<true>): Promise<void> {
    const settings = await getGuildSettings(message.guildId);
    if (!settings?.embedsEnabled) return;

    const { changed, content } = this.fix(message.content);
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

    const member = message.member;
    const sent = await this.send(channel, {
      content,
      username: (member?.displayName ?? message.author.username).slice(0, 80),
      // Discord's webhook avatar override ignores .webp (the default) and falls back to the
      // blank avatar, so force a PNG.
      avatarURL: (member ?? message.author).displayAvatarURL({ extension: 'png', size: 256 }),
      threadId: channel.isThread() ? channel.id : undefined,
      // The bot posts on a member's behalf, so it never pings anyone.
      allowedMentions: { parse: [] },
    });
    if (!sent) return;
    const reason = t(message.guild.preferredLocale, 'embeds.deleteReason');
    await this.logs.expectMessageDelete(message.guildId, message.id, reason);
    // Message#delete takes no reason; the audit log should say why the bot removed a member's message.
    await message.client.rest
      .delete(Routes.channelMessage(message.channelId, message.id), { reason })
      .catch(() => undefined);
  }

  /** Sends through the channel's webhook, replacing it once if someone deleted it. */
  private async send(
    channel: GuildTextBasedChannel,
    payload: WebhookMessageCreateOptions,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const webhook = await this.webhookFor(channel);
      if (!webhook) return false;
      try {
        await webhook.send(payload);
        return true;
      } catch (error) {
        const gone =
          error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownWebhook;
        if (!gone) return false;
        this.webhooks.delete(webhook.channelId);
      }
    }
    return false;
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

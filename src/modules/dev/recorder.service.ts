import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Client, Routes } from 'discord.js';
import { Injectable } from '@/core';
import { logger } from '@/logger';
import { gatewayEvents } from '@/modules/plugins/plugin-manifest.service';
import { devEnUS } from './i18n/en-US';

const out = 'tests/fixtures/discord';
const recordedGuildId = '100000000000000001';
const recordedBotId = '100000000000000002';
const permissionKeys = new Set(['permissions', 'allow', 'deny', 'app_permissions']);
const enumKeys = new Set([
  't',
  'status',
  'desktop',
  'mobile',
  'web',
  'locale',
  'guild_locale',
  'preferred_locale',
  'content_type',
  'key',
]);
const componentNames: Record<number, string> = {
  2: 'button',
  3: 'string-select',
  5: 'user-select',
  6: 'role-select',
  8: 'channel-select',
};

// biome-ignore lint/suspicious/noExplicitAny: raw Discord JSON, read loosely
type Json = Record<string, any>;

/**
 * Replaces everything that identifies people or the server with stable placeholders, so the same
 * ID or name maps to the same value in every file, and relations between files still hold.
 */
class Anonymizer {
  private readonly ids = new Map<string, string>();
  private readonly texts = new Map<string, string>();
  readonly known = new Set<string>();
  private nextId = 3n;

  constructor(guildId: string, botId: string) {
    this.ids.set(guildId, recordedGuildId);
    this.ids.set(botId, recordedBotId);
  }

  private id(value: string): string {
    let mapped = this.ids.get(value);
    if (!mapped) {
      mapped = String(100000000000000000n + this.nextId++);
      this.ids.set(value, mapped);
    }
    return mapped;
  }

  private text(key: string, value: string): string {
    let mapped = this.texts.get(value);
    if (!mapped) {
      const n = this.texts.size + 1;
      mapped = /^https?:\/\//.test(value) ? `https://example.invalid/${key}-${n}` : `${key}-${n}`;
      this.texts.set(value, mapped);
    }
    return mapped;
  }

  private string(key: string, value: string): string {
    // Permission bitfields are digit strings as long as IDs.
    if (/^\d{17,20}$/.test(value) && !permissionKeys.has(key)) return this.id(value);
    if (/^\d{0,16}$/.test(value) || permissionKeys.has(key)) return value;
    if (/^\d{4}-\d\d-\d\dT[\d:.]+(Z|[+-]\d\d:\d\d)$/.test(value)) return value;
    if (enumKeys.has(key) || this.known.has(value)) return value;
    // Unicode emoji (reaction names) say nothing about anyone.
    if (key === 'name' && !/[\p{L}\p{N}]/u.test(value)) return value;
    return this.text(key, value);
  }

  apply(value: unknown, key = ''): unknown {
    if (typeof value === 'string') return this.string(key, value);
    if (Array.isArray(value)) return value.map((item) => this.apply(item, key));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          /^\d{17,20}$/.test(k) ? this.id(k) : k,
          this.apply(v, k),
        ]),
      );
    }
    return value;
  }
}

function messageVariant(d: Json): string {
  if (d.message_snapshots?.length) return '.forward';
  if (d.referenced_message) return '.reply';
  if (d.poll) return '.poll';
  if (d.attachments?.length) return '.attachment';
  if (d.embeds?.length) return '.embed';
  return '';
}

const isFidelityId = (id: unknown) => typeof id === 'string' && id.startsWith('dev.fidelity');

/** Which recording an interaction is, or null when it isn't one of /dev fidelity's. */
function interactionName(d: Json): string | null {
  const data = d.data ?? {};
  if (d.type === 2 || d.type === 4) {
    if (data.type === 2 && data.name === devEnUS.menus.user) return 'user-menu';
    if (data.type === 3 && data.name === devEnUS.menus.message) return 'message-menu';
    const fidelity = data.name === 'dev' && data.options?.[0]?.name === devEnUS.fidelity.name;
    if (!fidelity) return null;
    return d.type === 4 ? 'autocomplete' : 'command';
  }
  if (!isFidelityId(data.custom_id)) return null;
  if (d.type === 5) return 'modal';
  return componentNames[data.component_type] ?? null;
}

/** Our own names and IDs in an interaction: command, option, menu and component names. */
function ownStrings(data: unknown, into: Set<string>, key = ''): void {
  if (Array.isArray(data)) for (const item of data) ownStrings(item, into, key);
  else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (k !== 'resolved') ownStrings(v, into, k);
    }
  } else if (typeof data === 'string' && (key === 'name' || key === 'custom_id')) into.add(data);
}

/** Saves one anonymized example of each event and /dev fidelity interaction, for the plugin tests. */
@Injectable()
export class RecorderService {
  private session: { guildId: string; anonymizer: Anonymizer; seen: Set<string> } | null = null;

  get recording(): boolean {
    return this.session !== null;
  }

  async start(client: Client<true>, guildId: string): Promise<void> {
    const anonymizer = new Anonymizer(guildId, client.user.id);
    this.session = { guildId, anonymizer, seen: new Set() };
    const query = new URLSearchParams({ with_counts: 'true' });
    const guild = (await client.rest.get(Routes.guild(guildId), { query })) as Json;
    const channels = await client.rest.get(Routes.guildChannels(guildId));
    const { id, name, owner_id, preferred_locale, approximate_member_count, icon, roles } = guild;
    this.save('', 'server', {
      botId: client.user.id,
      guild: {
        id,
        name,
        owner_id,
        preferred_locale,
        member_count: approximate_member_count,
        icon,
        roles,
        channels,
      },
    });
  }

  stop(): number {
    const written = this.session?.seen.size ?? 0;
    this.session = null;
    return written;
  }

  capture(packet: { t?: string | null; d?: unknown }, botId: string): void {
    const session = this.session;
    const d = packet.d as Json | undefined;
    if (!session || !packet.t || !d || (d.guild_id ?? d.id) !== session.guildId) return;
    if (packet.t === 'INTERACTION_CREATE') {
      const name = interactionName(d);
      if (!name) return;
      ownStrings(d.data, session.anonymizer.known);
      if (d.data.component_type === 3)
        for (const v of d.data.values) session.anonymizer.known.add(v);
      this.save('interactions', name, { t: packet.t, d });
      return;
    }
    if (!Object.hasOwn(gatewayEvents, packet.t)) return;
    const variant = packet.t.startsWith('MESSAGE_') ? messageVariant(d) : '';
    const byBot = [d.author?.id, d.user_id, d.user?.id, d.member?.user?.id].includes(botId);
    this.save('gateway', `${packet.t}${variant}${byBot ? '.bot' : ''}`, { t: packet.t, d });
  }

  private save(folder: string, name: string, packet: unknown): void {
    const session = this.session;
    if (!session || session.seen.has(`${folder}/${name}`)) return;
    session.seen.add(`${folder}/${name}`);
    mkdirSync(join(out, folder), { recursive: true });
    const file = join(out, folder, `${name}.json`);
    writeFileSync(file, `${JSON.stringify(session.anonymizer.apply(packet), null, 2)}\n`);
    logger.info({ file }, 'Recorded a Discord payload');
  }
}

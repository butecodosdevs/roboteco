import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const maxBytes = 2 * 1024 * 1024;
const maxRedirects = 3;
const timeoutMs = 10_000;

export class UnsafeUrlError extends Error {}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));
    return lower === '::1' || lower === '::' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
  }
  const [a = 0, b = 0] = address.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError(`Unsupported protocol ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new UnsafeUrlError(`${url.hostname} resolves to a private address`);
  }
}

const userAgent = 'roboteco (+https://github.com/)';

// Fetches user-supplied URLs without letting them reach the bot's own network (SSRF).
export async function safeFetchText(
  input: string,
  { maxBytes: limit = maxBytes }: { maxBytes?: number } = {},
): Promise<string> {
  let url = new URL(input);
  for (let redirects = 0; ; redirects++) {
    await assertPublic(url);
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': userAgent, accept: '*/*' },
    });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      if (redirects >= maxRedirects) throw new Error('Too many redirects');
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) return '';
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error('Response too large');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}

/**
 * Follows a link's redirects with HEAD requests, without reading any body, and returns every
 * URL on the way, starting with `input`. Stops quietly at the first hop that fails or is private.
 */
export async function resolveRedirects(input: string, maxHops = 5): Promise<string[]> {
  const chain = [input];
  let url = new URL(input);
  for (let hop = 0; hop < maxHops; hop++) {
    try {
      await assertPublic(url);
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(5_000),
        headers: { 'user-agent': userAgent, accept: '*/*' },
      });
      const location = response.headers.get('location');
      if (response.status < 300 || response.status >= 400 || !location) break;
      url = new URL(location, url);
    } catch {
      break;
    }
    if (chain.includes(url.href)) break;
    chain.push(url.href);
  }
  return chain;
}

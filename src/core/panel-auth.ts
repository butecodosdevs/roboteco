import type { IncomingMessage } from 'node:http';

/**
 * The panel lives in core but sessions live in a feature module, so core only knows these hooks.
 * Without a registered check the panel accepts the `x-panel-token` header, which is what scripts use.
 */
export type PanelAuthCheck = (request: IncomingMessage) => Promise<boolean>;

let check: PanelAuthCheck | undefined;
const publicSegments = new Set<string>();

export function registerPanelAuth(next: PanelAuthCheck): void {
  check = next;
}

/** Routes under `/api/panel/<segment>` that answer before anyone logs in. */
export function registerPublicPanelSegment(...segments: string[]): void {
  for (const segment of segments) publicSegments.add(segment);
}

export const isPublicPanelSegment = (segment: string | undefined) =>
  segment !== undefined && publicSegments.has(segment);

export async function panelSessionValid(request: IncomingMessage): Promise<boolean> {
  if (!check) return false;
  return check(request).catch(() => false);
}

/** Reads one cookie without pulling a dependency in. */
export function cookie(request: IncomingMessage, name: string): string | undefined {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

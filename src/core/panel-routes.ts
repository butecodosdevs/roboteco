import type { Client } from 'discord.js';

export interface PanelRequest {
  /** Path after `/api/panel/<segment>/`. Empty when the route was called bare. */
  segments: string[];
  query: URLSearchParams;
  method: string;
  /** Parsed JSON body for POST/PUT/PATCH/DELETE, `undefined` otherwise. */
  body: unknown;
  client: Client;
}

export interface PanelReply {
  status?: number;
  body: unknown;
}

export type PanelRoute = (request: PanelRequest) => Promise<PanelReply> | PanelReply;

// Module-level because core cannot import feature modules; same shape as core/lifecycle.ts.
const routes = new Map<string, PanelRoute>();

export function registerPanelRoute(segment: string, route: PanelRoute): void {
  routes.set(segment, route);
}

export function panelRoute(segment: string): PanelRoute | undefined {
  return routes.get(segment);
}

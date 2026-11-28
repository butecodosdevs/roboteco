import type { IncomingMessage as Incoming, IncomingMessage, ServerResponse } from 'node:http';
import type { Client } from 'discord.js';
import { Injectable } from '@/core';

export interface PanelRequest {
  /** Path after `/api/panel/<segment>/`. Empty when the route was called bare. */
  segments: string[];
  query: URLSearchParams;
  method: string;
  /** Parsed JSON body for POST/PUT/PATCH/DELETE, `undefined` otherwise. */
  body: unknown;
  client: Client;
  /** Raw request, for cookies and the remote address. */
  request: IncomingMessage;
}

export interface PanelReply {
  status?: number;
  body: unknown;
  /** Extra response headers, used by the session routes to set and clear the cookie. */
  headers?: Record<string, string>;
}

export type PanelRoute = (request: PanelRequest) => Promise<PanelReply> | PanelReply;

/** Better Auth answers `/api/auth/*` itself; the panel only forwards. */
export type PanelAuthHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;
export type PanelAuthCheck = (request: IncomingMessage) => Promise<boolean>;

/**
 * Routes, sessions and the public-segment list, as an instance instead of module-level `let`s: the
 * panel is a feature, and a feature's state belongs to an object that can be created fresh.
 */
@Injectable()
export class PanelRouterService {
  private readonly routes = new Map<string, PanelRoute>();
  private readonly publicSegments = new Set<string>();
  private authHandler: PanelAuthHandler | undefined;
  private authCheck: PanelAuthCheck | undefined;

  route(segment: string, handler: PanelRoute): void {
    this.routes.set(segment, handler);
  }

  get(segment: string): PanelRoute | undefined {
    return this.routes.get(segment);
  }

  /** Routes under `/api/panel/<segment>` that answer before anyone logs in. */
  isPublic(segment: string | undefined): boolean {
    return segment !== undefined && this.publicSegments.has(segment);
  }

  publicSegment(...segments: string[]): void {
    for (const segment of segments) this.publicSegments.add(segment);
  }

  auth(next: PanelAuthCheck): void {
    this.authCheck = next;
  }

  authHandlerFor(next: PanelAuthHandler): void {
    this.authHandler = next;
  }

  async forwardAuth(request: Incoming, response: ServerResponse): Promise<boolean> {
    if (!this.authHandler) return false;
    await this.authHandler(request, response);
    return true;
  }

  async sessionValid(request: Incoming): Promise<boolean> {
    if (!this.authCheck) return false;
    return this.authCheck(request).catch(() => false);
  }
}

/** Reads one cookie without pulling a dependency in. */
export function cookie(request: Incoming, name: string): string | undefined {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

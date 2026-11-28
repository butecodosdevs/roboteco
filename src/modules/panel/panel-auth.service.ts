import type { IncomingMessage } from 'node:http';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '@/config';
import { Injectable, inject } from '@/core';
import { liveSetting, writeSettings } from '@/core/settings';
import { authSchema, db } from '@/db';
import { PanelRouterService } from './panel-router.service';

export interface PanelIdentity {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

/** Discord only, and only for the addresses in PANEL_ALLOWED_EMAILS. */
export const allowedEmails = (): string[] =>
  (liveSetting('PANEL_ALLOWED_EMAILS') ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

/** The OAuth app is the bot's own: same client id, plus the client secret. */
export const discordConfigured = () =>
  Boolean(config.clientId && process.env.DISCORD_CLIENT_SECRET);

/**
 * An allowlist, not a sign-up form: unknown addresses are refused before a user row exists, so a
 * stranger who finds the URL cannot even create an account.
 *
 * `null` when PANEL_SECRET is missing — the bot runs, the panel refuses logins. Better Auth throws
 * on a missing secret, and a misconfigured panel must not take the bot down with it.
 */
const auth = config.panelSecret
  ? betterAuth({
      baseURL: config.panelUrl,
      secret: config.panelSecret,
      database: drizzleAdapter(db, {
        provider: 'pg',
        schema: {
          user: authSchema.authUsers,
          session: authSchema.authSessions,
          account: authSchema.authAccounts,
          verification: authSchema.authVerifications,
        },
      }),
      session: {
        // A day is long enough to be useful and short enough to expire on its own.
        expiresIn: 60 * 60 * 24,
        updateAge: 60 * 60,
      },
      socialProviders: {
        discord: {
          clientId: config.clientId,
          clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
        },
      },
      databaseHooks: {
        user: {
          create: {
            before: async (user) => {
              const allow = allowedEmails();
              if (allow.length === 0) {
                throw new APIError('FORBIDDEN', { message: 'PANEL_ALLOWED_EMAILS is empty' });
              }
              // Discord returns a null email for phone-only accounts; those never get in.
              if (!user.email || !allow.includes(user.email.toLowerCase())) {
                throw new APIError('FORBIDDEN', { message: 'this Discord account has no access' });
              }
              // An allowlist entry names the address someone controls, and Discord only proves
              // control by flagging it verified. Without this check, anyone who types an
              // allowlisted address into a Discord account that never verified it gets a session
              // for a mailbox they do not own — the allowlist would be self-asserted.
              if (user.emailVerified !== true) {
                throw new APIError('FORBIDDEN', { message: 'verify your Discord email first' });
              }
            },
          },
        },
      },
    })
  : null;

const accessSchema = z.object({
  emails: z
    .array(z.string().trim().toLowerCase().email())
    .min(1)
    .max(50)
    .transform((list) => [...new Set(list)]),
});

/** Better Auth owns the sessions, so they survive a restart and live in the same Postgres. */
@Injectable()
export class PanelAuthService {
  private readonly router = inject(PanelRouterService);

  start(): void {
    this.router.publicSegment('auth');
    this.router.auth(async (request) => (await this.identity(request)) !== null);
    if (auth) this.router.authHandlerFor(toNodeHandler(auth));

    this.router.route('auth', async ({ segments: [action], method, body, request }) => {
      if (action === 'status' && method === 'GET') {
        const identity = await this.identity(request);
        return {
          body: {
            ready: Boolean(auth) && discordConfigured(),
            discord: discordConfigured(),
            secret: Boolean(auth),
            allowlist: allowedEmails().length,
            authenticated: identity !== null,
            user: identity,
          },
        };
      }
      // `auth` is a public segment so the login screen can answer; editing the allowlist is not.
      if (action === 'access') {
        if ((await this.identity(request)) === null) {
          return { status: 401, body: { error: 'unauthorized' } };
        }
        if (method === 'GET') return { body: { emails: allowedEmails() } };
      }
      if (action === 'access' && method === 'PUT') {
        // `.min(1)` below refuses an empty list: that would lock the only key inside the safe.
        const emails = accessSchema.parse(body ?? {}).emails;
        writeSettings({ PANEL_ALLOWED_EMAILS: emails.join(',') });
        // Sessions of removed emails are refused by `identity()`, but deleting the rows also clears
        // them from the database instead of leaving 24 h of dead sessions behind.
        if (auth) {
          const keep = new Set(emails);
          const users = await db
            .select({ id: authSchema.authUsers.id, email: authSchema.authUsers.email })
            .from(authSchema.authUsers);
          const drop = users.filter((u) => !keep.has(u.email.toLowerCase())).map((u) => u.id);
          if (drop.length > 0) {
            await db
              .delete(authSchema.authSessions)
              .where(inArray(authSchema.authSessions.userId, drop));
          }
        }
        return { body: { emails } };
      }
      if (action === 'logout' && method === 'POST') {
        await auth?.api
          .signOut({ headers: fromNodeHeaders(request.headers) })
          .catch(() => undefined);
        return { body: { ok: true } };
      }
      return { status: 405, body: { error: 'method_not_allowed' } };
    });
  }

  async identity(request: IncomingMessage): Promise<PanelIdentity | null> {
    if (!auth) return null;
    const session = await auth.api
      .getSession({ headers: fromNodeHeaders(request.headers) })
      .catch(() => null);
    if (!session) return null;
    // Checked again on every request: dropping an email from PANEL_ALLOWED_EMAILS must revoke a
    // session that already exists, not just block new sign-ups.
    if (!allowedEmails().includes(session.user.email.toLowerCase())) return null;
    // Same reason: a session created before the verified-email check existed must not outlive it.
    if (session.user.emailVerified !== true) return null;
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    };
  }
}

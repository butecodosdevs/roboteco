import type { IncomingMessage } from 'node:http';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '@/config';
import {
  Injectable,
  registerPanelAuth,
  registerPanelAuthHandler,
  registerPanelRoute,
  registerPublicPanelSegment,
} from '@/core';
import { liveSetting, writeSettings } from '@/core/settings';
import { authSchema, db } from '@/db';

export interface PanelIdentity {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

/** Google only, and only for the addresses in PANEL_ALLOWED_EMAILS. */
export const allowedEmails = (): string[] =>
  (liveSetting('PANEL_ALLOWED_EMAILS') ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

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
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID ?? '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        },
      },
      databaseHooks: {
        user: {
          create: {
            before: async (user) => {
              const allow = allowedEmails();
              if (allow.length === 0) {
                throw new APIError('FORBIDDEN', { message: 'PANEL_ALLOWED_EMAILS está vazio' });
              }
              if (!user.email || !allow.includes(user.email.toLowerCase())) {
                throw new APIError('FORBIDDEN', { message: 'este e-mail não tem acesso' });
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
    // Duplicates would render twice and mean nothing; order is whatever the panel sent.
    .transform((list) => [...new Set(list)]),
});

/** Better Auth owns the sessions, so they survive a restart and live in the same Postgres. */
@Injectable()
export class PanelAuthService {
  async start(): Promise<void> {
    registerPublicPanelSegment('auth');
    registerPanelAuth(async (request) => (await this.identity(request)) !== null);
    if (auth) registerPanelAuthHandler(toNodeHandler(auth));

    registerPanelRoute('auth', async ({ segments: [action], method, body, request }) => {
      if (action === 'status' && method === 'GET') {
        const identity = await this.identity(request);
        return {
          body: {
            ready: Boolean(auth) && googleConfigured(),
            google: googleConfigured(),
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
      return { status: 405, body: { error: `auth: ${method} não suportado` } };
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
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    };
  }
}

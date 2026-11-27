import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { config } from '@/config';
import {
  cookie,
  Injectable,
  registerPanelAuth,
  registerPanelRoute,
  registerPublicPanelSegment,
} from '@/core';

const derive = promisify(scrypt);
export const sessionCookie = 'panel_session';
const sessionTtlSeconds = 12 * 60 * 60;
const maxFailures = 5;
const failureWindow = 5 * 60 * 1000;

const authPath = resolve('panel/auth.json');
const authSchema = z.object({ salt: z.string(), hash: z.string() });

const passwordSchema = z.object({
  password: z.string().min(8, 'a senha precisa de pelo menos 8 caracteres'),
});

/**
 * One person runs this bot, so one password and sessions in memory are enough. A restart logs
 * everyone out, which is the honest trade for keeping sessions off the disk.
 */
@Injectable()
export class PanelAuthService {
  private readonly sessions = new Map<string, number>();
  private readonly failures = new Map<string, { count: number; at: number }>();
  private stored: z.infer<typeof authSchema> | null = null;

  /** Wires the core gate to this service and publishes `/api/panel/auth/*`. */
  async start(): Promise<void> {
    this.stored = await this.read();
    registerPublicPanelSegment('auth');
    registerPanelAuth((request) => this.valid(cookie(request, sessionCookie)));

    registerPanelRoute('auth', async ({ segments: [action], method, body, request }) => {
      if (action === 'status' && method === 'GET') {
        return {
          body: {
            /** True once a password hash exists, which is what the login screen checks. */
            password: this.stored !== null,
            authenticated: await this.valid(cookie(request, sessionCookie)),
          },
        };
      }
      if (action === 'login' && method === 'POST') {
        const { password } = z
          .object({ password: z.string().min(1, 'informe a senha') })
          .parse(body);
        const address = request.socket.remoteAddress ?? 'local';
        this.guard(address);
        const first = this.stored === null;
        if (!(await this.accept(password))) {
          this.fail(address);
          throw new Error('senha incorreta');
        }
        this.failures.delete(address);
        return {
          body: { ok: true, first },
          headers: { 'set-cookie': this.cookie(request, this.issue()) },
        };
      }
      if (action === 'logout' && method === 'POST') {
        const token = cookie(request, sessionCookie);
        if (token) this.sessions.delete(token);
        return { body: { ok: true }, headers: { 'set-cookie': this.cookie(request, '') } };
      }
      if (action === 'password' && method === 'POST') {
        const { current, password } = z
          .object({ current: z.string().min(1), password: z.string() })
          .parse(body);
        if (!(await this.accept(current))) throw new Error('senha atual incorreta');
        passwordSchema.parse({ password });
        await this.save(password);
        this.sessions.clear();
        return { body: { ok: true }, headers: { 'set-cookie': this.cookie(request, '') } };
      }
      return { status: 405, body: { error: `auth: ${method} não suportado` } };
    });
  }

  async valid(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const expiresAt = this.sessions.get(token);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  private issue(): string {
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(token, Date.now() + sessionTtlSeconds * 1000);
    return token;
  }

  private cookie(request: IncomingMessage, value: string): string {
    const secure =
      request.headers['x-forwarded-proto'] === 'https' ||
      (request.socket as { encrypted?: boolean }).encrypted === true;
    const parts = [
      `${sessionCookie}=${value}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${value ? sessionTtlSeconds : 0}`,
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
  }

  private guard(address: string): void {
    const entry = this.failures.get(address);
    if (!entry) return;
    if (Date.now() - entry.at > failureWindow) {
      this.failures.delete(address);
      return;
    }
    if (entry.count >= maxFailures) throw new Error('muitas tentativas; espere cinco minutos');
  }

  private fail(address: string): void {
    const entry = this.failures.get(address);
    if (!entry || Date.now() - entry.at > failureWindow) {
      this.failures.set(address, { count: 1, at: Date.now() });
      return;
    }
    entry.count += 1;
    entry.at = Date.now();
  }

  /**
   * The first login takes `PANEL_TOKEN` as the password and stores a hash of it. After that only
   * the scrypt hash matters, which is why the token can be removed from the environment later.
   */
  private async accept(password: string): Promise<boolean> {
    if (!this.stored) {
      if (!config.panelToken || password !== config.panelToken) return false;
      await this.save(password);
      return true;
    }
    const derived = (await derive(password, this.stored.salt, 64)) as Buffer;
    const expected = Buffer.from(this.stored.hash, 'hex');
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  }

  private async read(): Promise<z.infer<typeof authSchema> | null> {
    const raw = await readFile(authPath, 'utf8').catch(() => null);
    if (!raw) return null;
    const parsed = authSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  }

  private async save(password: string): Promise<void> {
    const salt = randomBytes(16).toString('hex');
    const hash = ((await derive(password, salt, 64)) as Buffer).toString('hex');
    this.stored = { salt, hash };
    await mkdir(dirname(authPath), { recursive: true });
    const temporary = `${authPath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.stored, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, authPath);
  }
}

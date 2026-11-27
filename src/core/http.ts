import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, resolve } from 'node:path';
import type { Client } from 'discord.js';
import { isCacheReady } from '@/cache';
import { reportError } from '@/logger';
import { handlePanel, isPanelPath } from './panel';

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

const webDir = resolve('web');
const maxJsonBytes = 64 * 1024;
const maxUploadBytes = 32 * 1024 * 1024;

class BodyTooLarge extends Error {}

/**
 * Reads the request into memory. JSON bodies are parsed; anything else (`application/zip`,
 * `application/wasm`) arrives as a Buffer, which is what the plugin upload route expects.
 */
async function readBody(request: IncomingMessage, limit: number): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) throw new BodyTooLarge('body too large');
    chunks.push(chunk);
  }
  if (length === 0) return undefined;
  const raw = Buffer.concat(chunks);
  if (!request.headers['content-type']?.includes('json')) return raw;
  return JSON.parse(raw.toString('utf8'));
}

async function serveStatic(path: string, response: ServerResponse): Promise<boolean> {
  const name = path === '/' ? 'index.html' : path.slice(1);
  if (!/^[\w.-]+$/.test(name)) return false;
  const type = types[extname(name)];
  if (!type) return false;
  const body = await readFile(resolve(webDir, name)).catch(() => null);
  if (!body) return false;
  response.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' }).end(body);
  return true;
}

export function startHttpServer(
  client: Client,
  port: number,
  options: { panelToken?: string } = {},
): Server {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    try {
      if (url.pathname === '/health') {
        const ready = client.isReady();
        response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            status: ready ? 'ok' : 'starting',
            ping: client.ws.ping,
            cache: isCacheReady() ? 'ok' : 'unavailable',
          }),
        );
        return;
      }
      if (isPanelPath(url.pathname)) {
        const upload = url.pathname.endsWith('/upload');
        await handlePanel(request, response, url, {
          client,
          token: options.panelToken,
          method: request.method ?? 'GET',
          body: await readBody(request, upload ? maxUploadBytes : maxJsonBytes),
        });
        return;
      }
      if (request.method === 'GET' && (await serveStatic(url.pathname, response))) return;
      response.writeHead(404).end();
    } catch (error) {
      if (error instanceof BodyTooLarge) {
        response
          .writeHead(413, { 'content-type': 'application/json' })
          .end(JSON.stringify({ error: 'arquivo maior que o limite' }));
        return;
      }
      reportError(error, { path: url.pathname }, 'HTTP request failed');
      if (!response.headersSent) response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'internal' }));
    }
  });
  server.listen(port, '0.0.0.0');
  return server;
}

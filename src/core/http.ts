import { readFile } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
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
        await handlePanel(request, response, url, client, { token: options.panelToken });
        return;
      }
      if (request.method === 'GET' && (await serveStatic(url.pathname, response))) return;
      response.writeHead(404).end();
    } catch (error) {
      reportError(error, { path: url.pathname }, 'HTTP request failed');
      if (!response.headersSent) response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'internal' }));
    }
  });
  server.listen(port, '0.0.0.0');
  return server;
}

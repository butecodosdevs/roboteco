import { createServer, type Server } from 'node:http';
import type { Client } from 'discord.js';
import { isCacheReady } from '@/cache';

export function startHealthServer(client: Client, port: number): Server {
  const server = createServer((request, response) => {
    if (request.url !== '/health') {
      response.writeHead(404).end();
      return;
    }
    const ready = client.isReady();
    response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' }).end(
      JSON.stringify({
        status: ready ? 'ok' : 'starting',
        ping: client.ws.ping,
        cache: isCacheReady() ? 'ok' : 'unavailable',
      }),
    );
  });
  server.listen(port, '0.0.0.0');
  return server;
}

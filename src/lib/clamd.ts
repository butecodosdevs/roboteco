import { createConnection } from 'node:net';

/** Where a clamd daemon listens for TCP connections. */
export interface ClamdAddress {
  host: string;
  port: number;
}

/** clamd's answer about one stream: clean, or the name of the signature that matched. */
export type ClamdResult = { infected: false } | { infected: true; signature: string };

const chunkBytes = 64 * 1024;
const timeoutMs = 60_000;

/** Whether clamd answers PING. Never throws. */
export async function pingClamd(address: ClamdAddress): Promise<boolean> {
  try {
    return (await exchange(address, [command('PING')])) === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Scans the bytes with INSTREAM, so nothing is written to disk.
 * Throws when clamd can't be reached or reports an error, such as a stream over its StreamMaxLength.
 */
export async function scanWithClamd(address: ClamdAddress, bytes: Buffer): Promise<ClamdResult> {
  return parseScanReply(await exchange(address, [command('INSTREAM'), ...streamFrames(bytes)]));
}

/** A command in clamd's `z` form: NUL-terminated, which makes the reply NUL-terminated too. */
function command(name: string): Buffer {
  return Buffer.from(`z${name}\0`);
}

/** INSTREAM framing: each chunk preceded by its length (4 bytes, big-endian), then a zero length. */
function* streamFrames(bytes: Buffer): Generator<Buffer> {
  for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
    const chunk = bytes.subarray(offset, offset + chunkBytes);
    yield lengthPrefix(chunk.length);
    yield chunk;
  }
  yield lengthPrefix(0);
}

function lengthPrefix(length: number): Buffer {
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32BE(length);
  return prefix;
}

/** The scan reply grammar: `stream: OK` or `stream: <signature> FOUND`. Anything else is an error report. */
function parseScanReply(reply: string): ClamdResult {
  if (reply === 'stream: OK') return { infected: false };

  const signature = /^stream: (.+) FOUND$/.exec(reply)?.[1];
  if (signature) return { infected: true, signature };

  throw new Error(`clamd: ${reply}`);
}

/** Sends one command on a new connection and returns the reply without its NUL terminator. */
function exchange(address: ClamdAddress, frames: Buffer[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(address);
    const reply: Buffer[] = [];
    const finish = () => {
      socket.destroy();
      resolve(Buffer.concat(reply).toString('utf8').replace(/\0+$/, '').trim());
    };

    socket.setTimeout(timeoutMs, () => socket.destroy(new Error('clamd timed out')));
    socket.on('error', reject);
    socket.on('connect', () => {
      for (const frame of frames) socket.write(frame);
    });
    // clamd may keep the connection open after the NUL that ends its reply.
    socket.on('data', (data: Buffer) => {
      reply.push(data);
      if (data.includes(0)) finish();
    });
    socket.on('end', finish);
  });
}

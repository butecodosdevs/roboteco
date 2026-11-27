// Run with: pnpm exec tsx scripts/zip-check.ts
// Asserts the zip reader against real archives built with the system zip, and the panel upload path.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

process.env.DATABASE_URL ??= 'postgres://roboteco:roboteco@localhost:5432/roboteco';
process.env.S3_ENDPOINT ??= 'http://localhost:3900';
process.env.S3_ACCESS_KEY_ID ??= 'x';
process.env.S3_SECRET_ACCESS_KEY ??= 'x';
process.env.S3_BUCKET ??= 'roboteco';
process.env.DISCORD_TOKEN ??= 'x';
process.env.DISCORD_CLIENT_ID ??= 'x';

const { readWasmUpload } = await import('@/core/zip');
const run = promisify(execFile);
const dir = await mkdtemp(join(tmpdir(), 'zip-check-'));
const wasm = Buffer.concat([
  Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
  Buffer.alloc(2048, 7),
]);

try {
  // bare .wasm goes straight through
  const bare = await readWasmUpload('coin', wasm);
  assert.equal(bare.entry, null);
  assert.deepEqual(bare.wasm, wasm);

  // stored zip named after the plugin
  await writeFile(join(dir, 'coin.wasm'), wasm);
  await run('zip', ['-q', '-0', join(dir, 'stored.zip'), 'coin.wasm'], { cwd: dir });
  const stored = await readWasmUpload('coin', await readFile(join(dir, 'stored.zip')));
  assert.equal(stored.entry, 'coin.wasm');
  assert.deepEqual(stored.wasm, wasm, 'stored entry round-trips');

  // deflated zip with a README, entry inside a folder
  await run('mkdir', ['-p', join(dir, 'pkg/example')]);
  await writeFile(join(dir, 'pkg/hello.wasm'), wasm);
  await writeFile(join(dir, 'pkg/README.md'), '# hi\n');
  await run('zip', ['-q', '-r', join(dir, 'packed.zip'), 'hello.wasm', 'README.md'], {
    cwd: join(dir, 'pkg'),
  });
  const packed = await readWasmUpload('hello', await readFile(join(dir, 'packed.zip')));
  assert.equal(packed.entry, 'hello.wasm');
  assert.deepEqual(packed.wasm, wasm, 'deflated entry round-trips');

  // renamed text is rejected before it reaches plugins/dist
  await assert.rejects(
    () => readWasmUpload('fake', Buffer.from('not a wasm at all')),
    /não é um \.wasm/,
  );

  // zip without a wasm
  await writeFile(join(dir, 'notes.txt'), 'x');
  await run('zip', ['-q', join(dir, 'empty.zip'), 'notes.txt'], { cwd: dir });
  const empty = await readFile(join(dir, 'empty.zip'));
  await assert.rejects(() => readWasmUpload('none', empty), /nenhum arquivo \.wasm/);

  // ambiguous archive asks for a rename instead of guessing
  await writeFile(join(dir, 'hello.wasm'), wasm);
  await run('zip', ['-q', join(dir, 'two.zip'), 'coin.wasm', 'hello.wasm'], { cwd: dir });
  const two = await readFile(join(dir, 'two.zip'));
  await assert.rejects(() => readWasmUpload('other', two), /renomeie o desejado/);

  // corrupted archive fails, does not hang
  await assert.rejects(() => readWasmUpload('bad', Buffer.from('PK\x03\x04broken')));
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log('zip check ok');

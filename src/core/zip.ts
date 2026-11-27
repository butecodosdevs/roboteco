import { promisify } from 'node:util';
import { inflateRaw } from 'node:zlib';

/** Every WASM the runtime accepts starts with `\0asm`, so a renamed text file is caught early. */
const magic = Buffer.from([0x00, 0x61, 0x73, 0x6d]);
const maxEntries = 512;
const maxWasmBytes = 32 * 1024 * 1024;

interface Entry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
}

export interface ZipUpload {
  /** Archive entry the WASM came from, `null` for a bare `.wasm` upload. */
  entry: string | null;
  wasm: Buffer;
}

const u16 = (buffer: Buffer, at: number) => (buffer[at] ?? 0) | ((buffer[at + 1] ?? 0) << 8);
const u32 = (buffer: Buffer, at: number) => (u16(buffer, at) | (u16(buffer, at + 2) << 16)) >>> 0;

/** Central directory of a zip: names, sizes and where each local header lives. */
function directory(buffer: Buffer): Entry[] {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('não parece um zip: falta o end of central directory');
  const count = u16(buffer, end + 10);
  if (count > maxEntries) throw new Error(`zip grande demais: ${count} arquivos`);
  let at = u32(buffer, end + 16);
  const list: Entry[] = [];
  for (let index = 0; index < count; index++) {
    if (u32(buffer, at) !== 0x02014b50) throw new Error('zip corrompido ou zip64');
    const nameLength = u16(buffer, at + 28);
    list.push({
      method: u16(buffer, at + 10),
      compressedSize: u32(buffer, at + 20),
      size: u32(buffer, at + 24),
      offset: u32(buffer, at + 42),
      name: buffer.toString('utf8', at + 46, at + 46 + nameLength),
    });
    at += 46 + nameLength + u16(buffer, at + 30) + u16(buffer, at + 32);
  }
  return list;
}

async function extract(buffer: Buffer, entry: Entry): Promise<Buffer> {
  if (entry.size > maxWasmBytes) throw new Error(`${entry.name}: passa de 32 MB`);
  const at = entry.offset;
  if (u32(buffer, at) !== 0x04034b50) throw new Error(`${entry.name}: entrada inválida`);
  const start = at + 30 + u16(buffer, at + 26) + u16(buffer, at + 28);
  const raw = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return promisify(inflateRaw)(raw);
  throw new Error(`${entry.name}: compressão ${entry.method} não suportada`);
}

/** Picks `<id>.wasm` when present, otherwise the only WASM in the archive. */
async function fromZip(buffer: Buffer, id: string): Promise<ZipUpload> {
  const candidates = directory(buffer).filter((entry) =>
    entry.name.toLowerCase().endsWith('.wasm'),
  );
  if (candidates.length === 0) throw new Error('o zip não tem nenhum arquivo .wasm');
  const target =
    candidates.find((entry) => entry.name === `${id}.wasm`) ??
    (candidates.length === 1 ? candidates[0] : undefined);
  if (!target) {
    throw new Error(
      `o zip tem ${candidates.length} arquivos .wasm (${candidates.map((e) => e.name).join(', ')}); renomeie o desejado para ${id}.wasm`,
    );
  }
  return { entry: target.name, wasm: await extract(buffer, target) };
}

/**
 * Reads a bare `.wasm` or a zip carrying one, entirely in memory: nothing from the upload is
 * written except the single WASM the caller asks for.
 */
/**
 * A `.wasm` or a zip holding one, validated in memory. The caller decides where to write it, so
 * an archive can never drop files outside that single path.
 */
export async function readWasmUpload(id: string, upload: Uint8Array): Promise<ZipUpload> {
  const buffer = Buffer.from(upload.buffer, upload.byteOffset, upload.byteLength);
  if (buffer.length === 0) throw new Error('arquivo vazio');
  const zipped = buffer.subarray(0, 2).toString('latin1') === 'PK';
  const picked = zipped ? await fromZip(buffer, id) : { entry: null, wasm: buffer };
  if (!picked.wasm.subarray(0, 4).equals(magic)) {
    throw new Error(`${picked.entry ?? 'o arquivo'} não é um .wasm (falta o magic \\0asm)`);
  }
  return picked;
}

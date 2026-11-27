export interface WasmImport {
  module: string;
  name: string;
}

// The ES2023 lib only ships WebAssembly's types; the runtime object is Node's global.
const Wasm = (
  globalThis as unknown as {
    WebAssembly: {
      Module: {
        new (bytes: Uint8Array): object;
        imports(module: object): WasmImport[];
        exports(module: object): { name: string; kind: string }[];
      };
    };
  }
).WebAssembly;

export function wasmExports(bytes: Uint8Array): string[] {
  return Wasm.Module.exports(new Wasm.Module(bytes)).map((e) => e.name);
}

export function wasmImports(bytes: Uint8Array): WasmImport[] {
  return Wasm.Module.imports(new Wasm.Module(bytes));
}

function readLeb(bytes: Uint8Array, offset: number): [value: number, next: number] {
  let value = 0;
  let shift = 0;
  let position = offset;
  for (;;) {
    const byte = bytes[position++] ?? 0;
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return [value, position];
    shift += 7;
  }
}

function leb(value: number): number[] {
  const out: number[] = [];
  let rest = value;
  do {
    let byte = rest & 0x7f;
    rest = Math.floor(rest / 128);
    if (rest !== 0) byte |= 0x80;
    out.push(byte);
  } while (rest !== 0);
  return out;
}

export class WasmMemoryError extends Error {}

/**
 * Rewrites the module's own linear memory so it declares `maxPages` as its maximum. Extism's JS SDK
 * only limits its own allocations, so without this a plugin could grow its memory to 4 GB.
 */
export function capMemory(bytes: Uint8Array, maxPages: number): Uint8Array {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let capped = false;
  while (offset < bytes.length) {
    const id = bytes[offset] ?? 0;
    const [size, payloadStart] = readLeb(bytes, offset + 1);
    const payloadEnd = payloadStart + size;
    if (id !== 5) {
      parts.push(bytes.subarray(offset, payloadEnd));
      offset = payloadEnd;
      continue;
    }
    let [count, cursor] = readLeb(bytes, payloadStart);
    const payload = leb(count);
    while (count-- > 0) {
      const flags = bytes[cursor++] ?? 0;
      if (flags & 0x02) throw new WasmMemoryError('shared memory is not allowed');
      if (flags & 0x04) throw new WasmMemoryError('64-bit memory is not allowed');
      const [min, afterMin] = readLeb(bytes, cursor);
      cursor = afterMin;
      let max = maxPages;
      if (flags & 0x01) {
        const [declared, afterMax] = readLeb(bytes, cursor);
        cursor = afterMax;
        max = Math.min(declared, maxPages);
      }
      if (min > max)
        throw new WasmMemoryError(`needs ${min} memory pages, the limit is ${maxPages}`);
      payload.push(0x01, ...leb(min), ...leb(max));
    }
    parts.push(Uint8Array.from([5, ...leb(payload.length), ...payload]));
    capped = true;
    offset = payloadEnd;
  }
  if (!capped && wasmImports(bytes).some((i) => i.name === 'memory')) {
    throw new WasmMemoryError('importing memory is not allowed');
  }
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;
  for (const part of parts) {
    result.set(part, position);
    position += part.length;
  }
  return result;
}

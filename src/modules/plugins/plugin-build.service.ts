import { execFile } from 'node:child_process';
import { copyFile, mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { promisify } from 'node:util';
import { Injectable } from '@/core';
import { registryPath } from './plugin-registry.service';

const run = promisify(execFile);
const pluginsDir = dirname(registryPath);
const timeout = 180_000;

export type Toolchain = 'go' | 'rust';

export interface PluginSource {
  /** Directory relative to the project root. */
  dir: string;
  toolchain: Toolchain;
  /** False when the compiler for this toolchain is not on the PATH. */
  available: boolean;
}

@Injectable()
export class PluginBuildService {
  private readonly probes = new Map<Toolchain, Promise<boolean>>();

  private probe(toolchain: Toolchain): Promise<boolean> {
    const cached = this.probes.get(toolchain);
    if (cached) return cached;
    const probe = run(toolchain, ['version']).then(
      () => true,
      () => false,
    );
    this.probes.set(toolchain, probe);
    return probe;
  }

  /** Matches `plugins/<id>` or `plugins/<id>-<anything>` that carries a Go or Cargo manifest. */
  async source(id: string): Promise<PluginSource | null> {
    const entries = await readdir(pluginsDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name !== id && !entry.name.startsWith(`${id}-`)) continue;
      const dir = join(pluginsDir, entry.name);
      const files = await readdir(dir).catch((): string[] => []);
      const toolchain: Toolchain | null = files.includes('Cargo.toml')
        ? 'rust'
        : files.includes('go.mod')
          ? 'go'
          : null;
      if (!toolchain) continue;
      return {
        dir: relative(process.cwd(), dir),
        toolchain,
        available: await this.probe(toolchain),
      };
    }
    return null;
  }

  /** Runs the toolchain with fixed argv (no shell), writing `plugins/dist/<id>.wasm`. */
  async build(id: string): Promise<{ log: string }> {
    const source = await this.source(id);
    if (!source) {
      throw new Error(
        `sem código-fonte para ${id}: esperava plugins/${id}-go ou plugins/${id}-rust`,
      );
    }
    if (!source.available) {
      throw new Error(`${source.toolchain} não está instalado nesta máquina`);
    }
    const out = join(pluginsDir, 'dist', `${id}.wasm`);
    await mkdir(dirname(out), { recursive: true });
    await this.compile(source, out).catch((error: { stderr?: string; message: string }) => {
      throw new Error(error.stderr?.trim() || error.message);
    });
    const { size } = await stat(out);
    return {
      log: `${source.toolchain}: ${Math.round(size / 1024)} KB em ${relative(process.cwd(), out)}`,
    };
  }

  private async compile(source: PluginSource, out: string): Promise<void> {
    if (source.toolchain === 'go') {
      await run('go', ['build', '-buildmode=c-shared', '-o', out, '.'], {
        cwd: source.dir,
        timeout,
        env: { ...process.env, GOOS: 'wasip1', GOARCH: 'wasm' },
      });
      return;
    }
    await run('cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown', '--quiet'], {
      cwd: source.dir,
      timeout,
    });
    const manifest = await readFile(join(source.dir, 'Cargo.toml'), 'utf8');
    const name = manifest.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
    if (!name) throw Object.assign(new Error('Cargo.toml sem campo name'), { stderr: '' });
    await copyFile(
      join(
        source.dir,
        'target',
        'wasm32-unknown-unknown',
        'release',
        `${name.replace(/-/g, '_')}.wasm`,
      ),
      out,
    );
  }
}

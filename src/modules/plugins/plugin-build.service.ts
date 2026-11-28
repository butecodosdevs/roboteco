import { readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { Injectable } from '@/core';
import { registryPath } from './plugin-registry.service';

const pluginsDir = dirname(registryPath);

export type Toolchain = 'go' | 'rust';

export interface PluginSource {
  /** Directory relative to the project root. */
  dir: string;
  toolchain: Toolchain;
}

/** Where a plugin's source lives, so the panel can point at it. Building stays in the repository. */
@Injectable()
export class PluginBuildService {
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
      return { dir: relative(process.cwd(), dir), toolchain };
    }
    return null;
  }
}

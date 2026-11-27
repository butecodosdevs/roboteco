import { rm } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('dist', { recursive: true, force: true });

await build({
  entryPoints: ['src/index.ts', 'src/deploy-commands.ts', 'src/db/migrate.ts'],
  outbase: 'src',
  outdir: 'dist',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  logLevel: 'info',
});

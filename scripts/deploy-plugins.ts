// Publishes plugin slash commands to Discord.
//   pnpm deploy-plugins               → every plugin in plugins/registry.json
//   pnpm deploy-plugins coin hello    → only those ids
// A deploy is a PUT, so whatever is not in the body disappears from Discord.
import { AppModule } from '@/app.module';
import { closeCache } from '@/cache';
import { resolveApp } from '@/core';
import { closeDb } from '@/db';
import { PluginDeployService } from '@/modules/plugins/plugin-deploy.service';
import { PluginManifestService } from '@/modules/plugins/plugin-manifest.service';
import { PluginRegistryService } from '@/modules/plugins/plugin-registry.service';

const app = resolveApp(AppModule);
const builtIn = new Set([...app.commands.keys(), ...app.contextMenus.keys()]);

const registry = new PluginRegistryService();
await registry.loadAll(undefined, (name) => builtIn.has(name));

const loaded = registry.all();
const wanted = process.argv.slice(2);
const unknown = wanted.filter((id) => !loaded.some((plugin) => plugin.id === id));
if (unknown.length > 0) {
  console.error(`not loaded, so nothing to deploy: ${unknown.join(', ')}`);
  console.error(`loaded: ${loaded.map((plugin) => plugin.id).join(', ') || '(none)'}`);
  process.exit(1);
}

const chosen = wanted.length > 0 ? loaded.filter((p) => wanted.includes(p.id)) : loaded;
const dropped = loaded.filter((plugin) => !chosen.includes(plugin));

const manifests = new PluginManifestService();
const body = [
  ...app.commands.map((command) => command.toJSON()),
  ...app.contextMenus.map((menu) => menu.toJSON()),
  ...chosen.flatMap((plugin) => [
    ...plugin.commands.map((spec) => manifests.toCommandJSON(spec)),
    ...plugin.contextMenus.map((spec) => manifests.toContextMenuJSON(spec)),
  ]),
];

if (dropped.length > 0) {
  console.warn(`leaving out ${dropped.map((p) => p.id).join(', ')}: their commands go away`);
}

const result = await new PluginDeployService().deploy(body);
console.log(
  `published ${body.length} commands (${chosen.length ? chosen.map((p) => p.id).join(', ') : 'no plugins'}) to ${result.guild}`,
);

await registry.unloadAll();
await closeDb();
await closeCache();

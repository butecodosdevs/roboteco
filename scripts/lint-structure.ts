import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = join(root, 'src');
const modulesDir = join(src, 'modules');
const appModule = join(src, 'app.module.ts');
const localesDir = join(src, 'i18n', 'locales');

interface Import {
  target: string;
  line: number;
}

interface SourceFile {
  path: string;
  rel: string;
  text: string;
  imports: Import[];
  exportedClass?: string;
}

interface Problem {
  file: string;
  line: number;
  message: string;
}

const decoratorFor = {
  command: 'Command',
  subcommand: 'Subcommand',
  'context-menu': 'UserContextMenu|MessageContextMenu',
  button: 'Button',
  select: 'SelectMenu',
  modal: 'Modal',
  event: 'On|Once',
  job: 'Job',
  module: 'Module',
  service: 'Injectable',
} as const;

const flatFolders: Record<string, Kind[]> = {
  events: ['event'],
  'context-menus': ['context-menu'],
  components: ['button', 'select', 'modal'],
  jobs: ['job'],
};
type Kind = keyof typeof decoratorFor;

const problems: Problem[] = [];
const report = (file: SourceFile | string, message: string, line = 1) =>
  problems.push({ file: typeof file === 'string' ? file : file.rel, line, message });

const lineAt = (text: string, index: number) => text.slice(0, index).split('\n').length;

function parse(path: string): SourceFile {
  const text = readFileSync(path, 'utf8');
  const imports: Import[] = [];
  for (const match of text.matchAll(
    /^(?:import|export)\s[^;]*?['"]((?:\.{1,2}|@)\/[^'"]+)['"]/gm,
  )) {
    const specifier = (match[1] as string).replace(/\.[jt]s$/, '');
    const base = specifier.startsWith('@/')
      ? join(src, specifier.slice(2))
      : resolve(dirname(path), specifier);
    imports.push({
      target: existsSync(`${base}.ts`) ? `${base}.ts` : join(base, 'index.ts'),
      line: lineAt(text, match.index),
    });
  }
  const exportedClass = /^export class (\w+)/m.exec(text)?.[1];
  return { path, rel: relative(root, path), text, imports, exportedClass };
}

const files = new Map<string, SourceFile>();
for (const entry of readdirSync(src, { recursive: true, encoding: 'utf8' })) {
  if (entry.endsWith('.ts')) files.set(join(src, entry), parse(join(src, entry)));
}

const kindOf = (path: string): Kind | undefined =>
  (Object.keys(decoratorFor) as Kind[]).find((kind) => path.endsWith(`.${kind}.ts`));

const moduleOf = (path: string): string | undefined => {
  if (!path.startsWith(modulesDir + sep)) return undefined;
  return relative(modulesDir, path).split(sep)[0];
};

const localeNames = readdirSync(localesDir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => basename(f, '.ts'));

function checkPlacement(file: SourceFile) {
  const feature = moduleOf(file.path);
  if (!feature) {
    const kind = kindOf(file.path);
    if (kind && file.path !== appModule) {
      report(file, `*.${kind}.ts files belong inside src/modules/<feature>/.`);
    }
    return;
  }

  const parts = relative(join(modulesDir, feature), file.path).split(sep);
  const name = parts.at(-1) as string;
  const [folder] = parts;

  if (parts.length === 1) {
    if (name === `${feature}.module.ts` || name.endsWith('.service.ts')) return;
    report(file, `Only ${feature}.module.ts and *.service.ts may sit at the root of a module.`);
  } else if (folder === 'commands') {
    if (parts.length !== 3) {
      report(file, 'Command files go in commands/<name>/.');
      return;
    }
    const commandName = parts[1] as string;
    if (name.endsWith('.command.ts') && name !== `${commandName}.command.ts`) {
      report(
        file,
        `The command in commands/${commandName}/ must be named ${commandName}.command.ts.`,
      );
    }
    if (kindOf(name) && !/\.(command|subcommand)\.ts$/.test(name)) {
      report(file, 'Only *.command.ts and *.subcommand.ts files may live in a command folder.');
    }
  } else if (folder && folder in flatFolders) {
    const allowed = flatFolders[folder] as Kind[];
    if (parts.length !== 2 || !allowed.includes(kindOf(name) as Kind)) {
      report(
        file,
        `The ${folder}/ folder only holds ${allowed.map((k) => `*.${k}.ts`).join(', ')} files.`,
      );
    }
  } else if (folder === 'i18n') {
    if (parts.length !== 2 || !localeNames.includes(basename(name, '.ts'))) {
      report(
        file,
        `i18n/ only holds locale files: ${localeNames.map((l) => `${l}.ts`).join(', ')}.`,
      );
    }
  } else {
    report(
      file,
      `Unexpected location. Modules contain commands/, context-menus/, components/, events/, jobs/, i18n/, *.module.ts and *.service.ts.`,
    );
  }
}

function checkDecorator(file: SourceFile) {
  const kind = kindOf(file.path);
  if (!kind) return;
  const decorators = [...file.text.matchAll(/^@(\w+)\(/gm)];
  const expected = new RegExp(`^(${decoratorFor[kind]})$`);
  const matching = decorators.filter((m) => expected.test(m[1] as string));
  if (matching.length !== 1 || decorators.length !== 1) {
    report(
      file,
      `A *.${kind}.ts file must export exactly one class decorated with @${decoratorFor[kind].replaceAll('|', '() or @')}().`,
    );
  }
}

function checkImports(file: SourceFile) {
  const from = moduleOf(file.path);
  const inLocales = file.path.startsWith(localesDir + sep);
  for (const { target, line } of file.imports) {
    const to = moduleOf(target);
    if (!to || to === from) continue;

    const featureRoot = join(modulesDir, to);
    const isPublic =
      target === join(featureRoot, `${to}.module.ts`) ||
      (dirname(target) === featureRoot && target.endsWith('.service.ts'));

    if (from) {
      if (!isPublic) {
        report(
          file,
          `Module "${from}" may only use ${to}.module.ts or a service of module "${to}", not ${relative(featureRoot, target)}.`,
          line,
        );
      }
    } else if (inLocales) {
      if (dirname(target) !== join(featureRoot, 'i18n')) {
        report(
          file,
          'Locale files may only import module translations from modules/<feature>/i18n/.',
          line,
        );
      }
    } else if (file.path !== appModule) {
      report(
        file,
        `${relative(src, file.path)} must not depend on feature modules; only app.module.ts imports them.`,
        line,
      );
    }
  }
}

type RegistrationKey =
  | 'imports'
  | 'commands'
  | 'contextMenus'
  | 'components'
  | 'events'
  | 'jobs'
  | 'subcommands';

function registrations(file: SourceFile, key: RegistrationKey) {
  const match = new RegExp(`\\b${key}\\s*:\\s*\\[([^\\]]*)\\]`).exec(file.text);
  return new Set(match?.[1]?.match(/\w+/g) ?? []);
}

function checkRegistration() {
  const registeredBy: Record<
    Exclude<Kind, 'service' | 'module'>,
    ['module' | 'command', RegistrationKey]
  > = {
    command: ['module', 'commands'],
    subcommand: ['command', 'subcommands'],
    'context-menu': ['module', 'contextMenus'],
    button: ['module', 'components'],
    select: ['module', 'components'],
    modal: ['module', 'components'],
    event: ['module', 'events'],
    job: ['module', 'jobs'],
  };

  for (const file of files.values()) {
    const kind = kindOf(file.path);
    if (!kind || kind === 'module' || !file.exportedClass) continue;

    if (kind === 'service') {
      const used = [...files.values()].some((f) => f.imports.some((i) => i.target === file.path));
      if (!used) report(file, `${file.exportedClass} is never injected.`);
      continue;
    }

    const [ownerKind, key] = registeredBy[kind];
    const owners = [...files.values()].filter(
      (f) =>
        kindOf(f.path) === ownerKind &&
        f.imports.some((i) => i.target === file.path) &&
        registrations(f, key).has(file.exportedClass as string),
    );
    if (owners.length === 0) {
      report(
        file,
        `${file.exportedClass} is not listed in any @${ownerKind === 'module' ? 'Module' : 'Command'}({ ${key} }).`,
      );
    }
  }

  const app = files.get(appModule);
  if (!app) {
    report(relative(root, appModule), 'Missing root module.');
    return;
  }
  const reachable = new Set<string>([appModule]);
  const queue = [app];
  while (queue.length > 0) {
    const current = queue.pop() as SourceFile;
    const names = registrations(current, 'imports');
    for (const { target } of current.imports) {
      const imported = files.get(target);
      if (
        imported?.exportedClass &&
        kindOf(target) === 'module' &&
        names.has(imported.exportedClass) &&
        !reachable.has(target)
      ) {
        reachable.add(target);
        queue.push(imported);
      }
    }
  }
  for (const file of files.values()) {
    if (kindOf(file.path) === 'module' && !reachable.has(file.path) && file.path !== appModule) {
      report(file, `${file.exportedClass ?? 'This module'} is not reachable from AppModule.`);
    }
  }
}

function checkModuleLayout() {
  for (const feature of readdirSync(modulesDir, { withFileTypes: true })) {
    if (!feature.isDirectory()) {
      report(
        relative(root, join(modulesDir, feature.name)),
        'src/modules/ only holds feature folders.',
      );
      continue;
    }
    const dir = join(modulesDir, feature.name);
    if (!files.has(join(dir, `${feature.name}.module.ts`))) {
      report(relative(root, dir), `Missing ${feature.name}.module.ts.`);
    }

    const commandsDir = join(dir, 'commands');
    const commands = readdirSync(dir).includes('commands')
      ? readdirSync(commandsDir, { withFileTypes: true }).filter((d) => d.isDirectory())
      : [];
    for (const command of commands) {
      if (!files.has(join(commandsDir, command.name, `${command.name}.command.ts`))) {
        report(
          relative(root, join(commandsDir, command.name)),
          `Missing ${command.name}.command.ts.`,
        );
      }
    }

    const i18nDir = join(dir, 'i18n');
    const hasUi = commands.length > 0 || readdirSync(dir).includes('context-menus');
    if (!readdirSync(dir).includes('i18n')) {
      if (hasUi) report(relative(root, dir), 'Modules with commands need an i18n/ folder.');
      continue;
    }
    for (const locale of localeNames) {
      const file = join(i18nDir, `${locale}.ts`);
      if (!files.has(file)) {
        report(relative(root, i18nDir), `Missing ${locale}.ts.`);
        continue;
      }
      const registry = files.get(join(localesDir, `${locale}.ts`));
      if (!registry?.imports.some((i) => i.target === file)) {
        report(relative(root, file), `Not registered in src/i18n/locales/${locale}.ts.`);
      }
    }
  }
}

for (const file of files.values()) {
  checkPlacement(file);
  checkDecorator(file);
  checkImports(file);
}
checkRegistration();
checkModuleLayout();

if (problems.length > 0) {
  for (const { file, line, message } of problems.sort((a, b) => a.file.localeCompare(b.file))) {
    console.error(`${file}:${line}  ${message}`);
  }
  console.error(`\n${problems.length} structural problem(s).`);
  process.exit(1);
}
console.log(`Structure OK (${files.size} files).`);

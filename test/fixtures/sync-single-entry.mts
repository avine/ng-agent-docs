/**
 * Rebuilds the single-entry fixture from the multi-entry one: same sources, but one entry point.
 *
 *   node test/fixtures/sync-single-entry.mts
 *
 * Edit only multi-entry/, then run this script: single-entry/ is fully regenerated.
 *   - every source file is copied to single-entry/src/lib/, keeping the folder layout;
 *   - secondary ng-packagr configurations (ng-package.json, or package.json with `ngPackage`) are dropped,
 *     so is the broken entry point;
 *   - imports between entry points (`@fixtures/multi-entry/core`) become relative imports;
 *   - src/public-api.ts re-exports every former entry point.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const FIXTURES = import.meta.dirname;
const MULTI = join(FIXTURES, 'multi-entry');
const SINGLE = join(FIXTURES, 'single-entry');
const LIB = join(SINGLE, 'src', 'lib');
const MULTI_NAME = '@fixtures/multi-entry';
const SINGLE_NAME = '@fixtures/single-entry';

// Files of the multi-entry root that describe the library itself, not its sources.
const ROOT_FILES = new Set(['package.json', 'ng-package.json', 'tsconfig.json', 'tsconfig.lib.json', 'index.ts']);
// Runtime decoys created by test/snapshot.mts, in case a run was interrupted.
const SKIP_DIRS = new Set(['node_modules', 'dist', '.cache']);

const toPosix = (p: string) => p.split(sep).join('/');
const readJson = <T,>(file: string) => JSON.parse(readFileSync(file, 'utf8')) as T;

/** Every file under `dir`, as paths relative to it. */
function walk(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = join(dir, d.name);
    if (d.isDirectory()) return SKIP_DIRS.has(d.name) ? [] : walk(full, base);
    return [relative(base, full)];
  });
}

// --- Secondary entry points of the multi-entry fixture, with an existing entry file
interface Secondary {
  slug: string; // 'forms/date'
  entryFile: string; // 'forms/date/index.ts', relative to the library root
}
type NgPackage = { lib?: { entryFile?: string } };
// Secondary ng-packagr configurations: an ng-package.json, or a package.json with an `ngPackage` field.
const configs = walk(MULTI)
  .map(toPosix)
  .filter((f) => f.includes('/'))
  .flatMap((f): { file: string; config: NgPackage }[] => {
    if (f.endsWith('/ng-package.json')) return [{ file: f, config: readJson<NgPackage>(join(MULTI, f)) }];
    if (!f.endsWith('/package.json')) return [];
    const { ngPackage } = readJson<{ ngPackage?: NgPackage }>(join(MULTI, f));
    return ngPackage ? [{ file: f, config: ngPackage }] : [];
  });
const secondaries: Secondary[] = configs
  .map(({ file, config }) => {
    const slug = dirname(file);
    return { slug, entryFile: `${slug}/${config.lib?.entryFile ?? 'src/public_api.ts'}` };
  })
  .filter((ep) => existsSync(join(MULTI, ep.entryFile)))
  .sort((a, b) => a.slug.localeCompare(b.slug, 'en'));

const brokenDirs = configs.map(({ file }) => dirname(file)).filter((slug) => !secondaries.some((ep) => ep.slug === slug));
const configFiles = new Set(configs.map(({ file }) => file));

// --- Copy the sources
rmSync(SINGLE, { recursive: true, force: true });
for (const file of walk(MULTI).map(toPosix)) {
  if (ROOT_FILES.has(file) || configFiles.has(file)) continue;
  if (brokenDirs.some((slug) => file.startsWith(`${slug}/`))) continue;
  const target = join(LIB, file);
  mkdirSync(dirname(target), { recursive: true });
  if (!file.endsWith('.ts')) {
    cpSync(join(MULTI, file), target);
    continue;
  }
  // `@fixtures/multi-entry/forms` → a relative import of the folder that was that entry point.
  const source = readFileSync(join(MULTI, file), 'utf8').replace(
    new RegExp(`'${MULTI_NAME}/([\\w/-]+)'`, 'g'),
    (_, slug: string) => {
      let path = toPosix(relative(dirname(target), join(LIB, slug)));
      if (path === '' || path === '.' || path === '..' || path.endsWith('/..')) path += '/index';
      return `'${path.startsWith('.') ? path : `./${path}`}'`;
    },
  );
  writeFileSync(target, source);
}

// --- Library files
const pkg = readJson<{ version: string }>(join(MULTI, 'package.json'));
writeFileSync(join(SINGLE, 'package.json'), JSON.stringify({ name: SINGLE_NAME, version: pkg.version }, null, 2) + '\n');
writeFileSync(join(SINGLE, 'ng-package.json'), JSON.stringify({ lib: { entryFile: 'src/public-api.ts' } }, null, 2) + '\n');

const tsconfig = readJson<{ compilerOptions: Record<string, unknown> }>(join(MULTI, 'tsconfig.lib.json'));
delete tsconfig.compilerOptions['paths']; // no cross entry point imports left
writeFileSync(join(SINGLE, 'tsconfig.lib.json'), JSON.stringify(tsconfig, null, 2) + '\n');

// strict: false changes the printed types (no `| undefined`): used by the --tsconfig test case.
writeFileSync(join(SINGLE, 'tsconfig.alt.json'), JSON.stringify({ extends: './tsconfig.lib.json', compilerOptions: { strict: false } }, null, 2) + '\n');

// The @packageDocumentation block must come first in the file: nothing may precede it.
const publicApi = [
  '/**',
  ' * Same sources as the multi-entry fixture, with every symbol exported from this single file.',
  ' * @packageDocumentation',
  ' */',
  '// Generated by test/fixtures/sync-single-entry.mts from the multi-entry fixture. Do not edit.',
  ...secondaries.map((ep) => `export * from './lib/${ep.entryFile.replace(/\.ts$/, '')}';`),
  '',
].join('\n');
writeFileSync(join(SINGLE, 'src', 'public-api.ts'), publicApi);

console.log(`single-entry: ${secondaries.length} former entry points re-exported from src/public-api.ts`);

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { DEST_DIR, LIB_ROOT, OUT_DIR, PKG } from './config.mts';
import { type EntryPoint, warnings } from './model.mts';
import { byName, toPosix } from './util.mts';

// =============================================================================
// Entry point discovery (ng-packagr)
// =============================================================================
// ng-packagr's default when an ng-package.json has no `lib.entryFile`.
const DEFAULT_ENTRY_FILE = 'src/public_api.ts';
// Folders never scanned for ng-package.json files. Absent from a library made by `ng generate library`,
// but --root may be the repository itself (standalone ng-packagr). Skipped by name: node_modules.
// By path: DEST_DIR and OUT_DIR, as an entry point may have the same folder name.
const SKIP_DIRS = new Set(['node_modules']);
const SKIP_PATHS = new Set([DEST_DIR, OUT_DIR]);

/** Every folder under `dir` that contains an ng-package.json, the library root included. */
function findNgPackageDirs(dir: string): string[] {
  const found = existsSync(join(dir, 'ng-package.json')) ? [dir] : [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, d.name);
    if (d.isDirectory() && !d.name.startsWith('.') && !SKIP_DIRS.has(d.name) && !SKIP_PATHS.has(child)) {
      found.push(...findNgPackageDirs(child));
    }
  }
  return found;
}

/**
 * Reads the @packageDocumentation block at the top of an entry file, used as the entry point's
 * one-line description in the index:
 *   /** Form fields built on Signal Forms. @packageDocumentation *\/
 */
function entryDescription(file: string): string | undefined {
  const block = /^\s*\/\*\*([\s\S]*?)\*\//.exec(readFileSync(file, 'utf8'))?.[1];
  if (!block || !/@packageDocumentation\b/.test(block)) return undefined;
  const text = block
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').replace(/@packageDocumentation\b/, '').trim())
    .filter(Boolean)
    .join('\n');
  return text || undefined;
}

/** Turns each ng-package.json into an EntryPoint. Folders whose entry file is missing are reported and skipped. */
export function discoverEntryPoints(): EntryPoint[] {
  const entryPoints: EntryPoint[] = [];
  for (const dir of findNgPackageDirs(LIB_ROOT)) {
    const config = JSON.parse(readFileSync(join(dir, 'ng-package.json'), 'utf8')) as { lib?: { entryFile?: string } };
    const file = resolve(dir, config.lib?.entryFile ?? DEFAULT_ENTRY_FILE);
    const slug = toPosix(relative(LIB_ROOT, dir));
    if (!existsSync(file)) {
      warnings.push(`${slug || '(primary)'}: entry file not found (${toPosix(relative(LIB_ROOT, file))})`);
      continue;
    }
    const importPath = slug ? `${PKG.name}/${slug}` : PKG.name;
    entryPoints.push({ importPath, slug, dir, file, description: entryDescription(file) });
  }
  return entryPoints.sort((a, b) => byName(a.importPath, b.importPath));
}

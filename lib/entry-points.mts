import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { type Config, type NgPackage, readNgPackage } from './config.mts';
import { type EntryPoint, warn } from './model.mts';
import { byName, toLf, toPosix } from './util.mts';

// =============================================================================
// Entry point discovery (ng-packagr)
// =============================================================================
// ng-packagr's default when the configuration has no `lib.entryFile`.
const DEFAULT_ENTRY_FILE = 'src/public_api.ts';
// Folders never scanned for entry points. Absent from a library made by `ng generate library`,
// but --root may be the repository itself (standalone ng-packagr). Skipped by name: node_modules.
// By path: destDir and outDir, as an entry point may have the same folder name.
const SKIP_DIRS = new Set(['node_modules']);

/**
 * Every folder under `dir` with an ng-packagr configuration, the library root included: an ng-package.json,
 * or a package.json with an `ngPackage` field.
 */
function findNgPackages(dir: string, skipPaths: Set<string | undefined>): { dir: string; file: string; config: NgPackage }[] {
  const own = readNgPackage(dir);
  const found = own ? [{ dir, ...own }] : [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, d.name);
    if (d.isDirectory() && !d.name.startsWith('.') && !SKIP_DIRS.has(d.name) && !skipPaths.has(child)) {
      found.push(...findNgPackages(child, skipPaths));
    }
  }
  return found;
}

/**
 * Reads the @packageDocumentation block of an entry file, used as the entry point's one-line description
 * in the index:
 *   /** Form fields built on Signal Forms. @packageDocumentation *\/
 * It is looked for in the comments at the top of the file, before any code: it may follow a license header.
 */
export function entryDescription(source: string): string | undefined {
  const comment = /\s*(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/y; // one comment, after blank lines
  for (let m = comment.exec(source); m; m = comment.exec(source)) {
    const block = /^\/\*\*([\s\S]*)\*\/$/.exec(m[1] ?? '')?.[1];
    if (!block || !/@packageDocumentation\b/.test(block)) continue;
    const text = toLf(block)
      .split('\n')
      .map((l) => l.replace(/^\s*\*\s?/, '').replace(/@packageDocumentation\b/, '').trim())
      .filter(Boolean)
      .join('\n');
    return text || undefined;
  }
  return undefined;
}

/** Turns each ng-packagr configuration into an EntryPoint. Folders whose entry file is missing are reported and skipped. */
export function discoverEntryPoints({ libRoot, pkg, destDir, outDir }: Config): EntryPoint[] {
  const entryPoints: EntryPoint[] = [];
  for (const { dir, file: ngPackage, config } of findNgPackages(libRoot, new Set([destDir, outDir]))) {
    const file = resolve(dir, config.lib?.entryFile ?? DEFAULT_ENTRY_FILE);
    const slug = toPosix(relative(libRoot, dir));
    if (!existsSync(file)) {
      warn(`${slug || '(primary)'}: entry file not found (${toPosix(relative(libRoot, file))})`, ngPackage);
      continue;
    }
    const importPath = slug ? `${pkg.name}/${slug}` : pkg.name;
    entryPoints.push({ importPath, slug, dir, file, description: entryDescription(readFileSync(file, 'utf8')) });
  }
  return entryPoints.sort((a, b) => byName(a.importPath, b.importPath));
}

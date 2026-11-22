import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { DeclaredEntryPoint, LibraryLayout } from './entry-points.mts';
import { fail, readJson } from './model.mts';
import { toPosix } from './util.mts';

// =============================================================================
// ng-packagr: an ng-package.json per entry point
// =============================================================================
// ng-packagr's default when the configuration has no `lib.entryFile`.
const DEFAULT_ENTRY_FILE = 'src/public_api.ts';
// Folders never scanned for entry points. Absent from a library made by `ng generate library`,
// but --root may be the repository itself (standalone ng-packagr). Skipped by name: node_modules.
// By path: dest and outDir, as an entry point may have the same folder name.
const SKIP_DIRS = new Set(['node_modules']);

/** The ng-packagr options read here. */
interface NgPackage {
  lib?: { entryFile?: string };
  dest?: string;
}

/**
 * ng-packagr configuration of a folder, as ng-packagr looks for it: its ng-package.json, otherwise the
 * `ngPackage` field of its package.json. Undefined when the folder has neither: it is not an entry point.
 * `file` is where the configuration was read, for messages.
 */
export function readNgPackage(dir: string): { file: string; config: NgPackage } | undefined {
  const ngPackage = join(dir, 'ng-package.json');
  if (existsSync(ngPackage)) return { file: ngPackage, config: readJson<NgPackage>(ngPackage) };
  const pkgFile = join(dir, 'package.json');
  if (!existsSync(pkgFile)) return undefined;
  let pkg: { ngPackage?: unknown };
  try {
    pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as { ngPackage?: unknown };
  } catch {
    return undefined; // a package.json of something else (a test fixture, a tool): not ours to judge
  }
  const config = pkg.ngPackage;
  return config && typeof config === 'object'
    ? { file: pkgFile, config: config as NgPackage }
    : undefined;
}

/**
 * Every folder under `dir` with an ng-packagr configuration, the library root included: an ng-package.json,
 * or a package.json with an `ngPackage` field.
 */
function findNgPackages(
  dir: string,
  skipPaths: Set<string | undefined>,
): { dir: string; file: string; config: NgPackage }[] {
  const own = readNgPackage(dir);
  const found = own ? [{ dir, ...own }] : [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, d.name);
    if (
      d.isDirectory() &&
      !d.name.startsWith('.') &&
      !SKIP_DIRS.has(d.name) &&
      !skipPaths.has(child)
    ) {
      found.push(...findNgPackages(child, skipPaths));
    }
  }
  return found;
}

/**
 * The ng-packagr layout: every folder with an ng-packagr configuration is an entry point, and the built
 * package is the `dest` of the library's own configuration, relative to the library folder (ng-packagr's
 * default: `dist`). Without that configuration, secondary entry points are still looked for.
 */
export function ngPackagrLayout(libRoot: string): LibraryLayout {
  const own = readNgPackage(libRoot);
  const dest = own && resolve(libRoot, own.config.dest ?? 'dist');
  return {
    entryPoints: (outDir): DeclaredEntryPoint[] =>
      findNgPackages(libRoot, new Set([dest, outDir])).map(({ dir, file, config }) => ({
        slug: toPosix(relative(libRoot, dir)),
        dir,
        file: resolve(dir, config.lib?.entryFile ?? DEFAULT_ENTRY_FILE),
        declaredIn: file,
      })),
    builtPackage: () =>
      own && dest
        ? { dir: dest, setting: `"dest" in ${own.file}` }
        : fail(
            `No ng-package.json (nor "ngPackage" in package.json) in ${libRoot}: pass --out <dir>.`,
          ),
  };
}

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { EXTRA_DOCS_DIR, GENERATED_MARKER } from './model.mts';
import { isInside, toPosix } from './util.mts';

// =============================================================================
// Config — from the command line (see README.md for the options)
// =============================================================================
// Usage error: exit code 2, so it is never mistaken for incomplete docs (exit code 1 in --strict mode).
export function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

const { values: args } = (() => {
  try {
    return parseArgs({
      options: {
        root: { type: 'string' },
        tsconfig: { type: 'string' },
        out: { type: 'string' },
        note: { type: 'string', multiple: true, default: [] },
        'extra-docs': { type: 'string' },
        'extra-docs-note': { type: 'string', multiple: true, default: [] },
        strict: { type: 'boolean', default: false },
      },
    });
  } catch (e) {
    return fail((e as Error).message); // unknown option, missing value…
  }
})();
if (!args.root) fail('Missing --root <library folder>, e.g. --root projects/my-lib');
export const LIB_ROOT = resolve(args.root);
export const TSCONFIG = resolve(args.tsconfig ?? join(LIB_ROOT, 'tsconfig.lib.json')); // needed so types resolve
export const NOTES = args.note;
export const EXTRA_DOCS = args['extra-docs'] ? resolve(args['extra-docs']) : undefined; // copied to OUT_DIR/extra-docs
export const EXTRA_DOCS_NOTES = args['extra-docs-note'];
if (EXTRA_DOCS_NOTES.length && !EXTRA_DOCS) fail('--extra-docs-note needs --extra-docs <folder>.');
export const STRICT = args.strict;
const PKG_FILE = join(LIB_ROOT, 'package.json');
if (!existsSync(PKG_FILE)) fail(`No package.json in ${LIB_ROOT}: --root must be the library folder.`);
export const PKG = JSON.parse(readFileSync(PKG_FILE, 'utf8')) as { name: string; version: string };
export const DEST_DIR = ngPackageDest(); // read even with --out: never scanned for entry points
export const OUT_DIR = args.out ? resolve(args.out) : join(builtPackageDir(), 'agent-docs'); // ⚠️ wiped on every run

// Files the OS adds to a folder opened in a file manager. Ignored by the --out safety check.
export const OS_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

// =============================================================================
// Default output folder: inside the built package
// =============================================================================
/**
 * Folder of the built package: the `dest` of the library's ng-package.json, relative to that file
 * (ng-packagr's default: `dist`). Undefined without an ng-package.json in the library folder.
 * Nothing is checked: with --out, the library does not have to be built.
 */
function ngPackageDest(): string | undefined {
  const ngPackage = join(LIB_ROOT, 'ng-package.json');
  if (!existsSync(ngPackage)) return undefined;
  const config = JSON.parse(readFileSync(ngPackage, 'utf8')) as { dest?: string };
  return resolve(LIB_ROOT, config.dest ?? 'dist');
}

/**
 * DEST_DIR, where agent-docs/ goes when --out is not given.
 *
 * ng-packagr empties `dest` at the start of every build, so the docs must be generated after it.
 * Exits with code 2 if there is no ng-package.json, if the package has not been built, or if `dest`
 * holds another package.
 */
function builtPackageDir(): string {
  const dest = DEST_DIR ?? fail(`No ng-package.json in ${LIB_ROOT}: pass --out <dir>.`);
  const builtPkg = join(dest, 'package.json');
  if (!existsSync(builtPkg)) {
    fail(`${builtPkg} not found: build the library first (ng build), agent-docs/ goes into the built package.`);
  }
  const { name } = JSON.parse(readFileSync(builtPkg, 'utf8')) as { name?: string };
  if (name !== PKG.name) fail(`${builtPkg} is the package ${name}, not ${PKG.name}: check "dest" in ${join(LIB_ROOT, 'ng-package.json')}.`);
  return dest;
}

// =============================================================================
// Output folder safety
// =============================================================================
/**
 * OUT_DIR is deleted on every run, so a wrong --out (`.`, the library folder, `src/`) would delete
 * source code. Exits with code 2, before anything is read or deleted, unless OUT_DIR is safe to wipe:
 * it does not exist, is empty, or holds only the output of a previous run (index.md with GENERATED_MARKER,
 * the .md pages under api/, and the copy of --extra-docs in extra-docs/, whatever it holds). The library
 * folder is also checked by path, for a clearer message.
 */
export function checkOutDir(): void {
  const generatedBefore = () => {
    const index = join(OUT_DIR, 'index.md');
    return existsSync(index) && readFileSync(index, 'utf8').includes(GENERATED_MARKER);
  };
  // What a previous run did not write, relative to OUT_DIR. A folder is listed, not its content.
  const notGenerated = (dir = OUT_DIR): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const path = toPosix(relative(OUT_DIR, join(dir, d.name)));
      const underApi = path === 'api' || path.startsWith('api/');
      if (OS_FILES.has(d.name)) return [];
      if (d.isDirectory() && path === EXTRA_DOCS_DIR) return [];
      if (d.isDirectory() && underApi) return notGenerated(join(dir, d.name));
      return d.isFile() && (path === 'index.md' || (underApi && path.endsWith('.md'))) ? [] : [path];
    });
  const contentReason = () => {
    if (readdirSync(OUT_DIR).every((name) => OS_FILES.has(name))) return undefined; // empty
    if (!generatedBefore()) return 'it is not empty and was not generated by this script (no index.md with the generated marker)';
    const others = notGenerated().sort(); // readdirSync order depends on the file system (NTFS: case-insensitive)
    const shown = others.slice(0, 5).join(', ') + (others.length > 5 ? `, and ${others.length - 5} more` : '');
    return others.length ? `it holds files not generated by this script (${shown})` : undefined;
  };
  const reason = isInside(LIB_ROOT, OUT_DIR)
    ? 'it is the library folder, or contains it'
    : !existsSync(OUT_DIR)
      ? undefined
      : !statSync(OUT_DIR).isDirectory()
        ? 'it is a file'
        : contentReason();
  if (reason) fail(`Refusing to use --out ${OUT_DIR}: ${reason}. It would be deleted.`);
}

/**
 * EXTRA_DOCS must be a folder with an index.md, the page the main index links to. Exits with code 2,
 * before anything is deleted, if it is not, or if it overlaps OUT_DIR: inside it (e.g. the extra-docs/
 * copy of a previous run), it would be deleted before being copied; containing it, copied into itself.
 */
export function checkExtraDocs(dir: string): void {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`--extra-docs ${dir}: not a folder.`);
  const index = join(dir, 'index.md');
  if (!existsSync(index) || !statSync(index).isFile()) fail(`--extra-docs ${dir}: no index.md in it, the main index links to it.`);
  if (isInside(dir, OUT_DIR)) fail(`Refusing to use --extra-docs ${dir}: it is inside the output folder ${OUT_DIR}, which is deleted on every run.`);
  if (isInside(OUT_DIR, dir)) fail(`Refusing to use --extra-docs ${dir}: it contains the output folder ${OUT_DIR}, it would be copied into itself.`);
}

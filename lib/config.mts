import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { EXTRA_DOCS_DIR, GENERATED_MARKER } from './model.mts';
import { isInside, toPosix } from './util.mts';

// =============================================================================
// Config — from the command line (see README.md for the options)
// =============================================================================
/** A wrong command line or library layout: exit code 2, so it is never mistaken for incomplete docs (1). */
export class UsageError extends Error {}

export function fail(message: string): never {
  throw new UsageError(message);
}

/** Reads a JSON file of the library, failing with its path when it is not valid JSON. */
export function readJson<T>(file: string): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch (e) {
    return fail(`${file}: not valid JSON (${(e as Error).message}).`);
  }
}

export interface Config {
  libRoot: string;
  tsconfig: string; // needed so types resolve
  notes: string[];
  extraDocs?: string | undefined; // copied to outDir/extra-docs
  extraDocsNotes: string[];
  strict: boolean;
  pkg: { name: string; version?: string | undefined };
  destDir?: string | undefined; // read even with --out: never scanned for entry points
  outDir: string; // ⚠️ wiped on every run
}

const HELP = `Usage: ng-agent-docs --root <library folder> [options]

Generates agent-docs/ (index.md, one page per symbol) from an Angular library's sources and JSDoc.
Run it after the library build: the docs go into the built package.

Options:
  --root <dir>              Library folder, with its ng-package.json and package.json. Required.
  --tsconfig <file>         Default: <root>/tsconfig.lib.json.
  --out <dir>               Default: <dest of ng-package.json>/agent-docs. Wiped on every run.
  --note <text>             Line added at the top of the index. Repeatable.
  --extra-docs <dir>        Hand-written docs with an index.md, copied to agent-docs/extra-docs/.
  --extra-docs-note <text>  Line shown above the link to the extra docs. Repeatable.
  --strict                  Exit code 1 when documentation is missing.
  -h, --help                Show this help.
  -v, --version             Show the version.

Exit codes: 0 done, 1 warnings with --strict, 2 usage error, 3 unexpected error.
Options, JSDoc tags and examples: README.md of the ng-agent-docs package.`;

/** Version of ng-agent-docs, from its package.json: one folder up from lib/ in the sources, from dist/ once bundled. */
function ownVersion(): string {
  return readJson<{ version?: string }>(join(import.meta.dirname, '..', 'package.json')).version ?? 'unknown';
}

/**
 * Reads the command line. Throws a UsageError when it, or the library layout, is wrong. `--help` and
 * `--version` give the text to print instead.
 */
export function readConfig(argv: string[]): Config | { print: string } {
  const { values: args } = (() => {
    try {
      return parseArgs({
        args: argv,
        options: {
          root: { type: 'string' },
          tsconfig: { type: 'string' },
          out: { type: 'string' },
          note: { type: 'string', multiple: true, default: [] },
          'extra-docs': { type: 'string' },
          'extra-docs-note': { type: 'string', multiple: true, default: [] },
          strict: { type: 'boolean', default: false },
          help: { type: 'boolean', short: 'h', default: false },
          version: { type: 'boolean', short: 'v', default: false },
        },
      });
    } catch (e) {
      return fail((e as Error).message); // unknown option, missing value…
    }
  })();
  if (args.help) return { print: HELP };
  if (args.version) return { print: ownVersion() };
  if (!args.root) fail('Missing --root <library folder>, e.g. --root projects/my-lib (see --help)');
  const libRoot = resolve(args.root);
  const extraDocs = args['extra-docs'] ? resolve(args['extra-docs']) : undefined;
  if (args['extra-docs-note'].length && !extraDocs) fail('--extra-docs-note needs --extra-docs <folder>.');
  const pkg = readPackage(libRoot);
  const destDir = ngPackageDest(libRoot);
  return {
    libRoot,
    tsconfig: resolve(args.tsconfig ?? join(libRoot, 'tsconfig.lib.json')),
    notes: args.note,
    extraDocs,
    extraDocsNotes: args['extra-docs-note'],
    strict: args.strict,
    pkg,
    destDir,
    outDir: args.out ? resolve(args.out) : join(builtPackageDir(libRoot, pkg.name, destDir), 'agent-docs'),
  };
}

/** The library's package.json: its name gives every import path, so it is required. */
function readPackage(libRoot: string): Config['pkg'] {
  const file = join(libRoot, 'package.json');
  if (!existsSync(file)) fail(`No package.json in ${libRoot}: --root must be the library folder.`);
  const { name, version } = readJson<{ name?: unknown; version?: unknown }>(file);
  if (typeof name !== 'string' || !name) fail(`${file}: no "name", the import path of the library.`);
  return { name, version: typeof version === 'string' ? version : undefined };
}

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
function ngPackageDest(libRoot: string): string | undefined {
  const ngPackage = join(libRoot, 'ng-package.json');
  if (!existsSync(ngPackage)) return undefined;
  return resolve(libRoot, readJson<{ dest?: string }>(ngPackage).dest ?? 'dist');
}

/**
 * destDir, where agent-docs/ goes when --out is not given.
 *
 * ng-packagr empties `dest` at the start of every build, so the docs must be generated after it.
 * Fails if there is no ng-package.json, if the package has not been built, or if `dest` holds another package.
 */
function builtPackageDir(libRoot: string, pkgName: string, destDir: string | undefined): string {
  const dest = destDir ?? fail(`No ng-package.json in ${libRoot}: pass --out <dir>.`);
  const builtPkg = join(dest, 'package.json');
  if (!existsSync(builtPkg)) {
    fail(`${builtPkg} not found: build the library first (ng build), agent-docs/ goes into the built package.`);
  }
  const { name } = readJson<{ name?: string }>(builtPkg);
  if (name !== pkgName) fail(`${builtPkg} is the package ${name}, not ${pkgName}: check "dest" in ${join(libRoot, 'ng-package.json')}.`);
  return dest;
}

// =============================================================================
// Output folder safety
// =============================================================================
/**
 * outDir is deleted on every run, so a wrong --out (`.`, the library folder, `src/`) would delete
 * source code. Fails, before anything is read or deleted, unless outDir is safe to wipe: it does not
 * exist, is empty, or holds only the output of a previous run (index.md with GENERATED_MARKER, the .md
 * pages under api/, and the copy of --extra-docs in extra-docs/, whatever it holds). The library folder
 * is also checked by path, for a clearer message.
 */
export function checkOutDir({ libRoot, outDir }: Config): void {
  // The marker on its own line, where every index.md has it: a page that merely quotes it does not count.
  const generatedBefore = () => {
    const index = join(outDir, 'index.md');
    return existsSync(index) && readFileSync(index, 'utf8').split(/\r?\n/).includes(GENERATED_MARKER);
  };
  // What a previous run did not write, relative to outDir. A folder is listed, not its content.
  const notGenerated = (dir = outDir): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const path = toPosix(relative(outDir, join(dir, d.name)));
      const underApi = path === 'api' || path.startsWith('api/');
      if (OS_FILES.has(d.name)) return [];
      if (d.isDirectory() && path === EXTRA_DOCS_DIR) return [];
      if (d.isDirectory() && underApi) return notGenerated(join(dir, d.name));
      return d.isFile() && (path === 'index.md' || (underApi && path.endsWith('.md'))) ? [] : [path];
    });
  const contentReason = () => {
    if (readdirSync(outDir).every((name) => OS_FILES.has(name))) return undefined; // empty
    if (!generatedBefore()) return 'it is not empty and was not generated by this script (no index.md with the generated marker)';
    const others = notGenerated().sort(); // readdirSync order depends on the file system (NTFS: case-insensitive)
    const shown = others.slice(0, 5).join(', ') + (others.length > 5 ? `, and ${others.length - 5} more` : '');
    return others.length ? `it holds files not generated by this script (${shown})` : undefined;
  };
  const reason = isInside(libRoot, outDir)
    ? 'it is the library folder, or contains it'
    : !existsSync(outDir)
      ? undefined
      : !statSync(outDir).isDirectory()
        ? 'it is a file'
        : contentReason();
  if (reason) fail(`Refusing to use --out ${outDir}: ${reason}. It would be deleted.`);
}

/**
 * extraDocs must be a folder with an index.md, the page the main index links to. Fails, before anything
 * is deleted, if it is not, or if it overlaps outDir: inside it (e.g. the extra-docs/ copy of a previous
 * run), it would be deleted before being copied; containing it, copied into itself.
 */
export function checkExtraDocs({ extraDocs: dir, outDir }: Config): void {
  if (!dir) return;
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`--extra-docs ${dir}: not a folder.`);
  const index = join(dir, 'index.md');
  if (!existsSync(index) || !statSync(index).isFile()) fail(`--extra-docs ${dir}: no index.md in it, the main index links to it.`);
  if (isInside(dir, outDir)) fail(`Refusing to use --extra-docs ${dir}: it is inside the output folder ${outDir}, which is deleted on every run.`);
  if (isInside(outDir, dir)) fail(`Refusing to use --extra-docs ${dir}: it contains the output folder ${outDir}, it would be copied into itself.`);
}

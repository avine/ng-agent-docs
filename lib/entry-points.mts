import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Config } from './config.mts';
import { libraryBuilderLayout } from './library-builder.mts';
import { type EntryPoint, readJson, warn } from './model.mts';
import { ngPackagrLayout, readNgPackage } from './ng-packagr.mts';
import { byName, toLf, toPosix } from './util.mts';

// =============================================================================
// Entry point discovery
// =============================================================================
// Where the entry points are declared depends on the library builder. Each builder has a LibraryLayout,
// chosen once by detectLayout(); from discoverEntryPoints() on, the run does not depend on the builder.

/** An entry point as the builder's configuration declares it, before the checks common to all builders. */
export interface DeclaredEntryPoint {
  slug: string; // import path without the package name: '' (primary) or 'forms'
  dir: string; // folder of its sources: see EntryPoint.dir
  file: string; // absolute path of the entry file, which may not exist
  declaredIn: string; // the configuration file that declares it, for messages
}

/** What depends on the library builder. */
export interface LibraryLayout {
  /** Every entry point the configuration declares. `outDir` is never scanned for them. */
  entryPoints(outDir: string): DeclaredEntryPoint[];
  /**
   * Folder of the built package, where agent-docs/ goes without --out, and the setting that gives it
   * (for messages). Fails when the configuration does not say. Whether it is built is not checked here.
   */
  builtPackage(): { dir: string; setting: string };
}

/**
 * The layout of the library in `libRoot`, from its configuration files: ng-packagr when the library folder
 * has an ng-packagr configuration (a library not migrated yet may also have `exports`), otherwise
 * @angular/build:library when its package.json has `exports`. Neither: ng-packagr, which still looks for
 * secondary entry points.
 */
export function detectLayout(libRoot: string): LibraryLayout {
  if (readNgPackage(libRoot)) return ngPackagrLayout(libRoot);
  const pkgFile = join(libRoot, 'package.json');
  const { exports } = readJson<{ exports?: unknown }>(pkgFile);
  return exports === undefined
    ? ngPackagrLayout(libRoot)
    : libraryBuilderLayout(libRoot, pkgFile, exports);
}

/**
 * Reads the @packageDocumentation block of an entry file, the entry point's description: its first sentence
 * in index.md, the whole text (paragraphs kept) in the entry point's own index:
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
      .map((l) =>
        l
          .replace(/^\s*\*\s?/, '')
          .replace(/@packageDocumentation\b/, '')
          .trim(),
      )
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text || undefined;
  }
  return undefined;
}

/** The entry points the layout declares. Those whose entry file is missing are reported and skipped. */
export function discoverEntryPoints({ libRoot, pkg, layout, outDir }: Config): EntryPoint[] {
  const entryPoints: EntryPoint[] = [];
  for (const { slug, dir, file, declaredIn } of layout.entryPoints(outDir)) {
    if (!existsSync(file)) {
      warn(
        `${slug || '(primary)'}: entry file not found (${toPosix(relative(libRoot, file))})`,
        declaredIn,
      );
      continue;
    }
    const importPath = slug ? `${pkg.name}/${slug}` : pkg.name;
    entryPoints.push({
      importPath,
      slug,
      dir,
      file,
      description: entryDescription(readFileSync(file, 'utf8')),
    });
  }
  return entryPoints.sort((a, b) => byName(a.importPath, b.importPath));
}

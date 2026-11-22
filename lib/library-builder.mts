import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, resolve } from 'node:path';
import type { DeclaredEntryPoint, LibraryLayout } from './entry-points.mts';
import { fail, readJson } from './model.mts';
import { isInside, toPosix } from './util.mts';

// =============================================================================
// @angular/build:library (Angular 22.3+): the entry points are the `exports` of the package.json
// =============================================================================
// The rules are the builder's own, so that a library it builds gets the same entry points here. Read in
// @angular/build 22.3.0: normalizeEntryPoints() and resolveTarget() in
// src/builders/library/pipeline/entry-points.js, the project root and `outputPath` in options.js.
//   "exports": { ".": "./src/public-api.ts", "./testing": "./testing/src/public-api.ts" }
// The built package's folder is the `outputPath` of the library's project in angular.json.

/** An entry point read from `exports`: its import path without the package name, and its entry file. */
export interface ExportsEntryPoint {
  slug: string; // '' (primary) or 'testing'
  target: string; // relative to the library folder: './testing/src/public-api.ts'
}

// A TypeScript source, not a declaration file.
const TS_FILE = /(?<!\.d)\.m?ts$/;

/** The path an `exports` value gives: a string, the first item of an array that gives one, or its `default`. */
function resolveTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = resolveTarget(item);
      if (target) return target;
    }
    return undefined;
  }
  return value && typeof value === 'object'
    ? resolveTarget((value as Record<string, unknown>)['default'])
    : undefined;
}

/**
 * The entry points of a package.json `exports` field, as @angular/build:library reads it. A string, an
 * array, or an object without subpath keys (only conditions) is the primary entry point. A value gives a
 * path (see resolveTarget()). A secondary subpath without a path, or whose target is not a TypeScript
 * source (a stylesheet, an asset, a .d.ts, `./package.json`), is not an entry point. Fails, as the builder
 * does, without a primary entry point, with an invalid subpath, a target outside the library folder or not
 * TypeScript, or with two entry points that differ only by case, slashes or hyphens.
 */
export function exportsEntryPoints(exports: unknown, file: string): ExportsEntryPoint[] {
  if (!exports || (typeof exports !== 'string' && typeof exports !== 'object'))
    fail(
      `${file}: "exports" must define the primary entry point ("."), e.g. "./src/public-api.ts".`,
    );
  // As Node.js reads it: an object none of whose keys starts with "." gives the conditions of ".".
  const subpaths =
    typeof exports === 'string' ||
    Array.isArray(exports) ||
    !Object.keys(exports).some((k) => k.startsWith('.'))
      ? { '.': exports }
      : (exports as object);
  const found: (ExportsEntryPoint & { key: string; bundle: string })[] = [];
  for (const [key, value] of Object.entries(subpaths)) {
    const target = resolveTarget(value);
    const name = toPosix(key)
      .replace(/\/+$/, '')
      .replace(/^\.(\/|$)/, '');
    const primary = name === '';
    if (!target) {
      if (primary)
        fail(`${file}: "exports" "${key}" must be a path, or have a "default" condition with one.`);
      continue; // a subpath for other conditions (`sass`, `style`): not compiled by the builder
    }
    if (!primary && !TS_FILE.test(target)) continue; // a stylesheet, an asset, a .d.ts: not an entry point
    if (posix.isAbsolute(name) || name.includes('..'))
      fail(`${file}: "exports" "${key}" must be a subpath without "..", e.g. "./testing".`);
    const inside = posix.normalize(toPosix(target));
    if (
      isAbsolute(target) ||
      posix.isAbsolute(inside) ||
      inside === '..' ||
      inside.startsWith('../')
    )
      fail(`${file}: "exports" "${key}" must point to a file in the library folder: ${target}.`);
    if (!TS_FILE.test(target))
      fail(`${file}: "exports" "${key}" must point to a TypeScript file (.ts or .mts): ${target}.`);
    // The builder names each bundle after its entry point, `/` turned into `-`, lowercased: they must differ.
    const bundle = primary ? '' : '-' + name.replaceAll('/', '-').toLowerCase();
    const same = found.find((ep) => ep.bundle === bundle);
    if (same)
      fail(
        `${file}: "exports" "${key}" is the same entry point as "${same.key}": entry points must not differ only by case, slashes or hyphens.`,
      );
    found.push({ slug: name, target, key, bundle });
  }
  if (!found.some((ep) => ep.slug === ''))
    fail(
      `${file}: "exports" must define the primary entry point ("."), e.g. "./src/public-api.ts".`,
    );
  return found.map(({ slug, target }) => ({ slug, target }));
}

/** The library's project in the first angular.json above it: its name and build options. */
interface Project {
  name: string;
  outputPath?: unknown;
}

/** The angular.json of the workspace, in the library folder or above it. */
function findWorkspace(libRoot: string): string | undefined {
  for (let dir = libRoot; ; dir = dirname(dir)) {
    const file = join(dir, 'angular.json');
    if (existsSync(file)) return file;
    if (dirname(dir) === dir) return undefined;
  }
}

/** The project of angular.json whose `root` is the library folder (no `root`: the workspace folder). */
function findProject(workspace: string, libRoot: string): Project | undefined {
  type Target = { options?: { outputPath?: unknown } };
  type Projects = Record<
    string,
    { root?: unknown; architect?: { build?: Target }; targets?: { build?: Target } }
  >;
  const { projects } = readJson<{ projects?: Projects }>(workspace);
  for (const [name, project] of Object.entries(projects ?? {})) {
    const root = project.root ?? '';
    if (typeof root !== 'string' || resolve(dirname(workspace), root) !== libRoot) continue;
    const build = project.architect?.build ?? project.targets?.build;
    return { name, outputPath: build?.options?.outputPath };
  }
  return undefined;
}

/** The @angular/build:library layout, for a library whose package.json (`pkgFile`) has an `exports` field. */
export function libraryBuilderLayout(
  libRoot: string,
  pkgFile: string,
  exports: unknown,
): LibraryLayout {
  return {
    entryPoints: (): DeclaredEntryPoint[] =>
      exportsEntryPoints(exports, pkgFile).map(({ slug, target }) => {
        const file = resolve(libRoot, target);
        // The primary entry point owns the whole library folder. A secondary one owns the folder named after
        // its subpath when its entry file is in it (`./testing` → testing/src/public-api.ts: testing/, as
        // the folder of its ng-package.json would be), otherwise the folder of its entry file.
        const named = join(libRoot, slug);
        const dir = !slug ? libRoot : isInside(file, named) ? named : dirname(file);
        return { slug, dir, file, declaredIn: pkgFile };
      }),
    builtPackage: () => {
      const workspace =
        findWorkspace(libRoot) ??
        fail(
          `No angular.json in ${libRoot} or above, to read the library's "outputPath": pass --out <dir>.`,
        );
      const project =
        findProject(workspace, libRoot) ??
        fail(`No project with the root ${libRoot} in ${workspace}: pass --out <dir>.`);
      const { name, outputPath } = project;
      return typeof outputPath === 'string'
        ? {
            dir: resolve(dirname(workspace), outputPath),
            setting: `"outputPath" of the project ${name} in ${workspace}`,
          }
        : {
            dir: resolve(dirname(workspace), 'dist', name),
            setting: `the project ${name} in ${workspace} (no "outputPath": dist/${name})`,
          };
    },
  };
}

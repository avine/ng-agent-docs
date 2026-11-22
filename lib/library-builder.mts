import { existsSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import type { DeclaredEntryPoint, LibraryLayout } from './entry-points.mts';
import { fail, readJson } from './model.mts';
import { toPosix } from './util.mts';

// =============================================================================
// @angular/build:library (Angular 22.3+): the entry points are the `exports` of the package.json
// =============================================================================
// The rules are the builder's own (normalizeEntryPoints() in @angular/build), so that a library it builds
// gets the same entry points here:
//   "exports": { ".": "./src/public-api.ts", "./testing": "./testing/src/public-api.ts" }
// The built package's folder is the `outputPath` of the library's project in angular.json.

/** An entry point read from `exports`: its import path without the package name, and its entry file. */
export interface ExportsEntryPoint {
  slug: string; // '' (primary) or 'testing'
  target: string; // as written, relative to the library folder: './testing/src/public-api.ts'
}

/**
 * The entry points of a package.json `exports` field, as @angular/build:library reads it. A string is the
 * primary entry point. A value is a path, or an object whose `default` condition is one. A secondary
 * subpath whose target is not a TypeScript file (a stylesheet, an asset, `./package.json`) is not an entry
 * point. Fails, as the builder does, without a primary entry point, or with an invalid subpath or target.
 */
export function exportsEntryPoints(exports: unknown, file: string): ExportsEntryPoint[] {
  if (!exports || (typeof exports !== 'string' && typeof exports !== 'object'))
    fail(
      `${file}: "exports" must define the primary entry point ("."), e.g. "./src/public-api.ts".`,
    );
  const subpaths = typeof exports === 'string' ? { '.': exports } : (exports as object);
  const found: ExportsEntryPoint[] = [];
  for (const [key, value] of Object.entries(subpaths)) {
    const target: unknown =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)['default']
        : value;
    const name = toPosix(key)
      .replace(/\/+$/, '')
      .replace(/^\.(\/|$)/, '');
    const primary = name === '';
    if (typeof target !== 'string') {
      if (primary)
        fail(`${file}: "exports" "${key}" must be a path, or have a "default" condition with one.`);
      continue; // a subpath for other conditions (`sass`, `style`): not compiled by the builder
    }
    if (!primary && !/\.m?ts$/.test(target)) continue; // a stylesheet, an asset: not an entry point
    if (posix.isAbsolute(name) || name.includes('..'))
      fail(`${file}: "exports" "${key}" must be a subpath without "..", e.g. "./testing".`);
    if (!/(?<!\.d)\.m?ts$/.test(target))
      fail(`${file}: "exports" "${key}" must point to a TypeScript file (.ts or .mts): ${target}.`);
    if (found.some((ep) => ep.slug === name))
      fail(`${file}: "exports" "${key}" is the same entry point as another subpath.`);
    found.push({ slug: name, target });
  }
  if (!found.some((ep) => ep.slug === ''))
    fail(
      `${file}: "exports" must define the primary entry point ("."), e.g. "./src/public-api.ts".`,
    );
  return found;
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

/** The project of angular.json whose `root` is the library folder. */
function findProject(workspace: string, libRoot: string): Project | undefined {
  type Target = { options?: { outputPath?: unknown } };
  type Projects = Record<
    string,
    { root?: unknown; architect?: { build?: Target }; targets?: { build?: Target } }
  >;
  const { projects } = readJson<{ projects?: Projects }>(workspace);
  for (const [name, project] of Object.entries(projects ?? {})) {
    if (typeof project.root !== 'string' || resolve(dirname(workspace), project.root) !== libRoot)
      continue;
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
        // The primary entry point owns the whole library folder, a secondary one the folder of its entry file.
        return { slug, dir: slug ? dirname(file) : libRoot, file, declaredIn: pkgFile };
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

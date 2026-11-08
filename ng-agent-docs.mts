#!/usr/bin/env node
/**
 * Generates agent-docs/ from an Angular library's sources and JSDoc: its public API, split into small
 * files for AI agents. Works with a single entry point and with ng-packagr secondary entry points.
 *
 *   agent-docs/index.md                    → compact catalog, grouped by entry point, one line per symbol
 *   agent-docs/api/<entry>/<Symbol>.md     → details of one symbol (primary entry point: api/<Symbol>.md)
 *   agent-docs/extra-docs/                 → copy of the --extra-docs folder, linked at the end of the index
 *
 * Run it right after the library build, the docs go into the built package:
 *   ng build my-lib && ng-agent-docs --root projects/my-lib --strict
 * Options, JSDoc tags and exit codes: see README.md.
 *
 * This file is the main flow, read it top to bottom. The rest is in lib/:
 *   config.mts          command-line options, output folder checks
 *   entry-points.mts    ng-packagr entry point discovery
 *   describe.mts        one symbol → its Markdown page, using:
 *     jsdoc.mts           JSDoc description and custom tags
 *     signatures.mts      function and method signatures
 *     bindings.mts        inputs, outputs and models, own and inherited
 *     host-directives.mts bindings exposed by host directives
 *     hidden-types.mts    library types a page shows but that have no page
 *     markdown.mts        parts shared by every page (header, binding lists, examples), and the index
 *   model.mts, util.mts shared types, warnings, small helpers
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { getCompilerOptionsFromTsConfig, Node, Project } from 'ts-morph';
import { checkExtraDocs, checkOutDir, type Config, fail, OS_FILES, readConfig, UsageError } from './lib/config.mts';
import { describe } from './lib/describe.mts';
import { discoverEntryPoints } from './lib/entry-points.mts';
import { renderIndex } from './lib/markdown.mts';
import {
  type Context,
  type Entry,
  type EntryPoint,
  EXTRA_DOCS_DIR,
  type Owners,
  type Warning,
  warn,
  warnings,
} from './lib/model.mts';
import { byName, isInside, toPosix } from './lib/util.mts';

// Exit codes: 0 done, 1 warnings in --strict mode, 2 usage error, 3 unexpected error (a bug, or the file system).
try {
  const config = readConfig(process.argv.slice(2));
  if ('print' in config) console.log(config.print); // --help, --version
  else process.exitCode = main(config);
} catch (e) {
  if (e instanceof UsageError) {
    console.error(e.message);
    process.exitCode = 2;
  } else {
    console.error('ng-agent-docs: unexpected error.');
    console.error(e);
    process.exitCode = 3;
  }
}

function main(config: Config): number {
  const { libRoot, tsconfig: tsconfigFile, extraDocs, outDir, strict } = config;

  // ===========================================================================
  // Main 1: load the library
  // ===========================================================================
  checkOutDir(config);
  checkExtraDocs(config);
  const entryPoints = discoverEntryPoints(config);
  if (!entryPoints.length) {
    fail(`No entry point found under ${libRoot}: no ng-package.json (nor package.json with "ngPackage") with an existing entry file.`);
  }
  if (!existsSync(tsconfigFile)) fail(`${tsconfigFile} not found: pass --tsconfig <file>.`);

  // Map every import path to its entry file, so imports between entry points
  // (e.g. `@acme/ui/core` used in `forms`) resolve to the sources, not to a dist/ build.
  const tsconfig = getCompilerOptionsFromTsConfig(tsconfigFile).options;
  const paths = { ...tsconfig.paths, ...Object.fromEntries(entryPoints.map((ep) => [ep.importPath, [ep.file]])) };
  const project = new Project({ tsConfigFilePath: tsconfigFile, compilerOptions: { paths } });

  // ===========================================================================
  // Main 2: collect exports and assign each declaration to one owner entry point
  // ===========================================================================
  // The same declaration can be exported by several entry points (re-exports), and under several names
  // (`export { A as B }`). It is documented once, under its owner: the entry point whose folder contains
  // its source file.
  const exported = new Map<Node, { ep: EntryPoint; name: string }[]>();
  for (const ep of entryPoints) {
    const sourceFile = project.getSourceFile(ep.file) ?? project.addSourceFileAtPath(ep.file);
    // getExportedDeclarations() follows `export * from` chains: we get exactly the public API.
    for (const [name, decls] of sourceFile.getExportedDeclarations()) {
      // Every exported name gets a page or a warning: nothing disappears silently.
      if (name === 'default') {
        warn(`${ep.importPath}: default export not documented, export it by name`, ep.file);
        continue;
      }
      if (!decls.length) {
        warn(`${ep.importPath}: export \`${name}\` could not be resolved, not documented`, ep.file);
        continue;
      }
      // An overloaded function is exported once per signature: keep one declaration, the implementation
      // if there is one (a .d.ts has only overloads).
      const fns = decls.filter(Node.isFunctionDeclaration);
      const keptFn = fns.find((f) => !f.isOverload()) ?? fns[0];
      for (const decl of decls) {
        if (Node.isFunctionDeclaration(decl) && decl !== keptFn) continue;
        exported.set(decl, [...(exported.get(decl) ?? []), { ep, name }]);
      }
    }
  }

  // Owner of each declaration: the deepest exporting entry point containing its file, otherwise the
  // first one that exports it. The page takes the name the owner exports it under, the declaration's own
  // name if it is one of them (`export { A, A as B }` → A); its other exports are listed on the page.
  // Computed for all of them first, so a page can link to another one.
  const owned = [...exported].map(([decl, exports]) => {
    const file = resolve(decl.getSourceFile().getFilePath()); // ts-morph paths use `/`, ep.dir the OS separator
    const eps = [...new Set(exports.map((x) => x.ep))];
    const owner =
      eps.filter((ep) => isInside(file, ep.dir)).sort((a, b) => b.dir.length - a.dir.length)[0] ?? eps[0]!; // eps is never empty
    const ownNames = exports.filter((x) => x.ep === owner).map((x) => x.name);
    const declName = Node.hasName(decl) ? decl.getName() : undefined;
    const name = ownNames.find((n) => n === declName) ?? ownNames[0]!;
    const alsoFrom = exports
      .filter((x) => x.ep !== owner || x.name !== name)
      .map((x) => ({ importPath: x.ep.importPath, name: x.name }));
    return { decl, name, ep: owner, alsoFrom };
  });

  // Page of each symbol, relative to outDir: api/<entry slug>/<Symbol>.md. Names that differ only by case
  // (`FxSize`, `fxSize`) would share one file on a case-insensitive file system (macOS, Windows), where the
  // package may be unpacked: the first in code point order keeps `<Name>.md`, the next ones get `<Name>-2.md`,
  // `-3`… (no name has a `-`).
  const docPath = (e: { name: string; ep: EntryPoint }) => ['api', e.ep.slug, `${e.name}.md`].filter(Boolean).join('/');
  const pageOf = new Map<string, string>(); // docPath → page
  const sharing = new Map<string, number>(); // lowercased docPath → number of pages using it so far
  for (const path of [...new Set(owned.map(docPath))].sort()) {
    const n = (sharing.get(path.toLowerCase()) ?? 0) + 1;
    sharing.set(path.toLowerCase(), n);
    pageOf.set(path, n === 1 ? path : path.replace(/\.md$/, `-${n}.md`));
  }
  // Also read while pages are described: to link a host directive's page, and to know which classes have one.
  const owners: Owners = new Map<Node, { name: string; ctx: Context }>(
    owned.map(({ decl, name, ep, alsoFrom }) => [decl, { name, ctx: { ep, alsoFrom, page: pageOf.get(docPath({ name, ep }))! } }]),
  );

  const byFile = new Map<string, { entry: Entry; decl: Node }[]>(); // doc file path → described declarations
  for (const [decl, { name, ctx }] of owners) {
    const owner = ctx.ep;
    const entry = describe(name, decl, ctx, { root: libRoot, owners });
    if (!entry) {
      warn(
        Node.isSourceFile(decl)
          ? `${owner.importPath}: namespace re-export \`${name}\` (export * as ${name}) not documented, export its members by name`
          : `${owner.importPath}: export \`${name}\` (${decl.getKindName()}) not supported, not documented`,
        Node.isSourceFile(decl) ? owner.file : decl,
      );
      continue;
    }
    byFile.set(entry.page, [...(byFile.get(entry.page) ?? []), { entry, decl }]);
  }

  // One name can cover several declarations (e.g. an interface and a const): merge them into one file.
  // The documented one comes first: its description, kind and tags make the index line.
  const entries: Entry[] = [...byFile.values()].map((list) => {
    const main = list.find((x) => x.entry.doc.description) ?? list[0]!; // each list has at least one entry
    // Documentation completeness check (fails the run in --strict mode): one description per page is enough.
    if (!main.entry.doc.description) warn(`${main.entry.name}: missing JSDoc description`, main.decl);
    const parts = [main, ...list.filter((x) => x !== main)];
    return { ...main.entry, markdown: parts.map((x) => x.entry.markdown).join('\n\n---\n\n') };
  });
  entries.sort((a, b) => byName(a.name, b.name));

  // ===========================================================================
  // Main 3: write one file per symbol (full regeneration)
  // ===========================================================================
  // Removed or renamed symbols must not leave stale files behind.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true }); // for index.md, even when no symbol gets a page
  for (const e of entries) {
    const file = join(outDir, e.page);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, e.markdown + '\n');
  }
  // The extra docs, as they are. Symbolic links are replaced with the files they point to: the package must
  // hold the files themselves.
  if (extraDocs) {
    const filter = (src: string) => !OS_FILES.has(basename(src));
    cpSync(extraDocs, join(outDir, EXTRA_DOCS_DIR), { recursive: true, dereference: true, filter });
  }

  // ===========================================================================
  // Main 4: write the index — one section per entry point, then one sub-section per kind
  // ===========================================================================
  const index = renderIndex(entryPoints, entries, {
    pkg: config.pkg,
    notes: config.notes,
    extraDocs: !!extraDocs,
    extraDocsNotes: config.extraDocsNotes,
  });
  writeFileSync(join(outDir, 'index.md'), index + '\n');

  // ===========================================================================
  // Report
  // ===========================================================================
  console.log(`agent-docs: ${entries.length} symbols from ${entryPoints.length} entry point(s) → ${outDir}`);
  if (!warnings.length) return 0;
  // A base class is read once per subclass: its warnings would repeat.
  const unique = [...new Set(warnings.map((w) => formatWarning(w, libRoot)))];
  console.warn(`\n${unique.length} warning(s):\n` + unique.map((w) => `  - ${w}`).join('\n'));
  return strict ? 1 : 0;
}

/** `path:line: message`, the path relative to the library folder, so editors and CI logs can link it. */
function formatWarning({ message, file, line }: Warning, libRoot: string): string {
  if (!file) return message;
  const path = resolve(file);
  if (!isInside(path, libRoot)) return message; // e.g. a base class in node_modules: its path tells nothing
  return `${toPosix(relative(libRoot, path))}${line ? `:${line}` : ''}: ${message}`;
}

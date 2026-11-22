# ng-agent-docs

> This script was vibe coded with Claude Code (Opus 5.5, high effort).

Generates compact, per-symbol API docs from an Angular library's JSDoc, so AI agents read only what
they need instead of the `.d.ts` files.

An agent that needs one input of one component usually reads a whole `.d.ts` file, or the component's
source. `ng-agent-docs` turns the library's public API into small markdown files, shipped inside the
package:

```
agent-docs/index.md                  catalog: one line per entry point
agent-docs/api/<entry>/index.md      one line per symbol of that entry point
agent-docs/api/<entry>/<Symbol>.md   one symbol: import, selector, inputs, outputs, slots, usage, examples
```

The agent reads the catalog, then the index of each entry point its task needs, then only the pages it
needs: a library with hundreds of symbols does not fill its context with all of them. A library with a
single entry point has no `api/<entry>/index.md`: `index.md` lists its symbols directly.

It works with a single entry point (one `public-api.ts`) and with secondary entry points, whether the
library is built with ng-packagr or with `@angular/build:library` (Angular 22.3 and later), and reads both decorator bindings (`@Input()`, `@Output()`) and signal bindings (`input()`, `model()`,
`output()`).

## Install

```bash
npm install --save-dev ng-agent-docs
```

Node 22 or later.

## Use it in the library build

The docs are generated from the JSDoc, never edited, and written into the built package
(`dist/<lib>/agent-docs/`). They always match the published code, and are never committed.

Run the command **after** `ng build`: the build empties `dist/<lib>` first.
In the workspace's `package.json`:

```json
"scripts": {
  "build:my-lib": "ng build my-lib && ng-agent-docs --root projects/my-lib --strict"
}
```

`--strict` fails the build when the docs are incomplete, so an incomplete package is never published.
Incomplete means a symbol without a description, an undocumented input, output, or public member of a
service or class, or a page that shows a type of the library that has no page (`add(opts: AddOptions)`
with `AddOptions` exported by no entry point: the agent cannot look it up), or, with several entry
points, one without a description (see below): `index.md` gives the agent nothing else to choose it. A
`@see` that refers to a symbol of the library without a page, or a `{@link}` that TypeScript cannot
resolve (not imported, or misspelled), is reported too, and so is an export declared outside the folder
of its entry point (see [Entry points](#entry-points)). A component's undocumented public methods are not counted: they are template
handlers.

Each warning starts with the file and line to fix, relative to `--root`:

```
  - core/functions.ts:68: toOption: shows the type FxOptionInit (core/internal.ts), which has no page: export it from an entry point
```

There is nothing to add to the build configuration: the folder is written after the build, next to the
built `package.json`.

## Entry points

The command reads the library's build configuration in `--root`, whichever builder makes it:

- **ng-packagr**: when `--root` has an `ng-package.json` (or a `package.json` with an `ngPackage`
  field). Every such folder under `--root` is an entry point, with its `lib.entryFile` (default
  `src/public_api.ts`). The built package is `dest` (default `dist`).
- **`@angular/build:library`** (Angular 22.3 and later): otherwise, when the `package.json` has an
  `exports` field. Every subpath pointing to a `.ts` or `.mts` file (not a `.d.ts`) of the library
  folder is an entry point, `"."` being the primary one, as the builder reads them (a value can also be
  an array, or a `default` condition):

  ```json
  "exports": { ".": "./src/public-api.ts", "./testing": "./testing/src/public-api.ts" }
  ```

  The command refuses the `exports` the builder refuses: no `"."`, an entry file outside the library
  folder, or two subpaths that differ only by case, slashes or hyphens (`./a/b` and `./a-b`).

  The built package is the `outputPath` of the library's project in the nearest `angular.json` (the
  project whose `root` is `--root`; no `root`: the `angular.json` folder), or `dist/<project>` without one.

A library not migrated yet to the new builder keeps working as before: ng-packagr wins when both are
there.

A symbol exported by several entry points gets one page, under the entry point whose folder holds its
file: the primary entry point owns the whole library, a secondary one the folder of its `ng-package.json`
(ng-packagr), or with `exports` the folder named after its subpath when its entry file is in it
(`./testing` → `testing/`), otherwise the folder of its entry file. The other entry points are listed on the page. An entry point should
export only the files of its own folder, and what other entry points export through their import path
(`@acme/ui/core`): a declaration of the library outside the folder of every entry point that exports it,
reached by a relative import, is still documented, with a warning. What comes from another package (a
dependency, or another library of the workspace through tsconfig `paths`) is not reported.

## Options

| Option                     |                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--root <dir>`             | Library folder, the one containing `package.json` (and `ng-package.json` with ng-packagr). Required.                                                     |
| `--tsconfig <file>`        | Default: `<root>/tsconfig.lib.json`.                                                                                                                     |
| `--out <dir>`              | Default: `agent-docs/` in the built package (see [Entry points](#entry-points)). Without `--out`, the command stops if the library is not built yet.     |
| `--note <text>`            | Line added at the top of `index.md`, for the agent. Repeatable.                                                                                          |
| `--extra-docs <dir>`       | Hand-written docs, copied to `agent-docs/extra-docs/` and linked at the end of `index.md`. The folder can have any name, and must contain an `index.md`. |
| `--extra-docs-note <text>` | Line shown between the heading of that last section and its link. Repeatable. Needs `--extra-docs`.                                                      |
| `--strict`                 | Exit code 1 when documentation is missing (warnings).                                                                                                    |
| `-h`, `--help`             | Show the options.                                                                                                                                        |
| `-v`, `--version`          | Show the version.                                                                                                                                        |

The output folder is deleted and fully regenerated on every run, so removed symbols leave no stale
page. The command refuses an `--out` that is or contains the library, or that holds files it did not
generate.

Exit codes: `0` done, `1` warnings with `--strict`, `2` usage error (options, or a missing or invalid
`package.json`, `ng-package.json` or `angular.json`), `3` unexpected error.

## Document the library

Everything comes from the library's sources:

- **Entry points**: from the build configuration, see [Entry points](#entry-points).
- **Public API**: what each entry file exports. Internal code never appears.
- **Angular metadata**: selector, inputs and outputs (decorators, signals, `inputs`/`outputs` arrays,
  inherited from base classes, exposed by `hostDirectives`, the base classes' included), `<ng-content>`
  slots, what an input's `transform` accepts, the `exports` of an `NgModule`.
- **Classes and services**: public properties and methods, own and inherited from base classes of the
  library, static members (`forRoot()`), and the constructor of a plain class.
- **Usage**: JSDoc tags on the class.

| Tag                  | Use                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| first sentence       | Short description, shown in the index.                                                                                                                        |
| `@usage`             | When to use it. One tag per case.                                                                                                                             |
| `@avoid`             | When not to use it, and what to use instead. One tag per case.                                                                                                |
| `@replacedBy`        | Newer equivalent to prefer in new code (legacy library).                                                                                                      |
| `@replaces`          | Older elements this one replaces, e.g. `mat-form-field`.                                                                                                      |
| `@example`           | Code example, fenced (without a fence: an HTML template). Can contain `@if`, `@for` and `@let` blocks.                                                        |
| `@deprecated`        | Deprecation message.                                                                                                                                          |
| `@param`, `@returns` | Parameters and return value of a function, method or pipe.                                                                                                    |
| `@default`           | Default value of an input whose default is not in the code (setter, `inputs` metadata).                                                                       |
| `@see`               | Related symbol or page, listed under "See also"; on a member (method, property, constructor, input, output, model), under that member. One tag per reference. |

`@see FxTooltip` and `@see {@link FxTooltip}` link to the page of `FxTooltip`, from any entry point; a
member (`{@link FxDialogRef.close}`, `FxDialogRef.close()` or `FxDialogRef#close`) links to its class's page. A reference to the
page it is on is not linked. TypeScript resolves
the name as for "Go to definition": it must be declared or imported in the file. `{@link FxTooltip | the
tooltip}` sets the link text, and a URL becomes a link. Other text is kept as written: `@see the theming
guide`. A symbol of another package is named with its package, not linked. A broken `@see` on an
inherited member is reported once, on the page of the class that declares it.

An entry point gets a description from a `@packageDocumentation` block at the top of its entry file:

```ts
/** Form fields built on Signal Forms. @packageDocumentation */
```

Its first sentence is shown in `index.md`, next to the entry point: write it so that an agent can tell
whether its task needs that entry point. The whole block, paragraphs included, is shown at the top of
the entry point's own index (`api/<entry>/index.md`).

For a legacy library being replaced, tell agents which library to prefer:

```bash
ng-agent-docs --root projects/legacy-lib --strict \
  --note "Legacy library: in new code, use @acme/ui whenever an equivalent exists (marked ⚠️)."
```

## Add hand-written docs

Some knowledge is not tied to one symbol: guides, theming, migration notes. Keep it in a folder of the
library, with an `index.md`, and pass it with `--extra-docs`:

```bash
ng-agent-docs --root projects/my-lib --strict \
  --extra-docs projects/my-lib/guides \
  --extra-docs-note "Guides: theming, forms, migration from Angular Material."
```

Everything in the folder is copied, as is, to `agent-docs/extra-docs/` (symbolic links are replaced with
the files they point to). The index ends with a section linking to `extra-docs/index.md`, after the
`--extra-docs-note` lines, if any:

```md
## Additional documentation

Guides: theming, forms, migration from Angular Material.

[extra-docs/index.md](extra-docs/index.md)
```

The copy is refreshed on every run, like the rest of the output: edit the original folder, not the
copy. The command refuses an `--extra-docs` folder that is inside the output folder, or that contains it.

## In the applications that use the library

In their `CLAUDE.md` or `AGENTS.md`:

```md
## @acme/ui

API: read node_modules/@acme/ui/agent-docs/index.md, then the index of each entry point you need,
then only the relevant api/.../<Symbol>.md files. Read @acme/ui's .d.ts files only if that page does not answer.
```

The `exports` field of the built package only limits imports: agents can still read
`node_modules/<package>/agent-docs/` as plain files.

## Development

The command is written in TypeScript: `ng-agent-docs.mts` (the main flow) and its modules in `lib/`.
Node runs it directly (22.18 or later), without a build. The published package contains a single file
instead, `dist/ng-agent-docs.mjs`, bundled by esbuild in `prepack`: Node does not strip types from files
under `node_modules`.

```bash
npm install
npm run typecheck     # strict type check of the command and the test scripts
npm test              # unit tests of the parsers, then snapshot test on the fixtures (CI)
npm run test:update   # accept an intended change in the output
npm run test:dist     # same snapshot test, on the bundled dist/ng-agent-docs.mjs
```

Test libraries and expected output are in [test/fixtures/](test/fixtures/README.md).

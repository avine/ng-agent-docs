# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`ng-agent-docs` is a CLI that reads an Angular library's sources (via ts-morph) and writes `agent-docs/`:
an `index.md` catalog plus one Markdown page per exported symbol (`api/<entry slug>/<Symbol>.md`), meant
to be shipped in the built package for AI agents. User-facing behavior (options, JSDoc tags, exit codes,
`--strict` warnings) is specified in [README.md](README.md); keep it in sync with any behavior change.

## Commands

Node ≥ 22.18 runs the `.mts` files directly (type stripping): no build is needed during development.

```bash
npm run typecheck     # tsc, strict; covers ng-agent-docs.mts, lib/, test/
npm test              # unit tests, then the snapshot test (what CI runs, plus test:dist)
npm run test:unit     # node --test test/unit.mts
node --test --test-name-pattern="parseJsDoc" test/unit.mts   # a single unit test / describe block
npm run test:update   # accept the current output as the new snapshot (rewrites all of test/fixtures/expected/)
npm run test:dist     # bundle with esbuild, then run the snapshot test against dist/ng-agent-docs.mjs
npm run sync-fixtures # regenerate test/fixtures/single-entry/ from multi-entry/
```

Run the generator by hand on a fixture (the snapshot runner has no per-case filter):

```bash
node ng-agent-docs.mts --root test/fixtures/multi-entry --out <scratch dir>
```

CI ([.github/workflows/test.yml](.github/workflows/test.yml)) runs typecheck, `npm test` and `test:dist` on
Ubuntu, macOS and Windows with Node 22 and 24: paths must work with both separators, and output must not
depend on line endings or file-system case sensitivity.

## Architecture

[ng-agent-docs.mts](ng-agent-docs.mts) is the main flow, meant to be read top to bottom; its header comment
maps every module in [lib/](lib/). The pipeline:

1. **Load** — `config.mts` parses options and validates the output folder (it is `rm -rf`'d each run, so
   the command refuses an `--out` that is/contains the library or holds files without the
   `GENERATED_MARKER`). `entry-points.mts` finds every `ng-package.json` (or `package.json` with
   `ngPackage`). A single ts-morph `Project` is built with `paths` mapping each entry point's import path
   to its source entry file, so cross-entry-point imports resolve to sources, not `dist/`.
2. **Assign owners** — every exported declaration (via `getExportedDeclarations()`, which follows
   `export *`) gets exactly one owner entry point (deepest one containing its file) and one page name.
   Pages differing only by case get `-2`, `-3` suffixes. The `Owners` map is computed for all symbols
   _before_ any page is described, so pages can link to each other and detect "hidden types".
3. **Describe** — `describe.mts` turns one declaration into an `Entry` (kind + Markdown), using
   `jsdoc.mts` (custom tags), `signatures.mts`, `bindings.mts` (decorator and signal inputs/outputs/models,
   including inherited), `host-directives.mts`, `members.mts`, `hidden-types.mts` (library types shown on a
   page that have no page of their own → warning) and `markdown.mts` (shared rendering + the index).
   Multiple declarations sharing a name (e.g. interface + const) are merged into one page.
4. **Write** — wipe the output folder, write pages, copy `--extra-docs`, write `index.md`, print warnings.

Warnings are pushed to a module-level array in `model.mts` via `warn(message, node|file)`; they carry a
file and line and are printed relative to `--root`. Every export must end up with a page or a warning —
never dropped silently. Exit codes: 0 ok, 1 warnings with `--strict`, 2 `UsageError` (via `fail()`),
3 unexpected error.

## Tests

- [test/unit.mts](test/unit.mts): unit tests for the regex-heavy text parsers only.
- [test/snapshot.mts](test/snapshot.mts): runs the generator on each case in `CASES`, records
  `console.txt` (command, stdout/stderr, exit code) and selected generated files in
  `test/fixtures/expected/<case>/`, and diffs against the committed snapshot. After a generator change:
  run `npm test`, read the diff, then `npm run test:update` if intended, and commit `expected/` with it.
- Fixtures ([test/fixtures/README.md](test/fixtures/README.md)): **edit only `multi-entry/`** (source of
  truth; each symbol's JSDoc says what it tests), then `npm run sync-fixtures`. `single-entry/` and
  `expected/` are generated — do not edit by hand. Both fixtures must produce identical symbol pages
  apart from the import line and "Also exported from". The fixture sources are not compiled (excluded
  from `tsconfig.json`); some breakage, like `missing-template.html`, is intentional. The README's
  "Known limitations" list is pinned by the snapshot on purpose.

## Packaging

The published package contains only `dist/ng-agent-docs.mjs` (see README's "Development" for why).
`ts-morph` is the only runtime dependency and stays external. TypeScript config uses `erasableSyntaxOnly` and `verbatimModuleSyntax`: no enums, namespaces or
parameter properties; use `import type` and `.mts` extensions in relative imports.

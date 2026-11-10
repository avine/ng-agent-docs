# agent-docs fixtures

Test libraries for `ng-agent-docs.mts`. Each case of the generator is covered by at least
one symbol, whose JSDoc says what it tests.

| Folder | Content |
|---|---|
| `multi-entry/` | **Source of truth.** Modern layout: empty primary entry point, secondary entry points (one nested, one using ng-packagr's default `src/public_api.ts`, one configured in its `package.json`, one broken). |
| `single-entry/` | Legacy layout: the same sources, everything exported from `src/public-api.ts`. **Generated, do not edit.** |
| `no-entry-point/` | A library without any `ng-package.json`: the generator must exit with code 2. |
| `guides/` | Hand-written docs for `--extra-docs`: an `index.md`, a nested page and a non-markdown file. |
| `expected/` | Snapshot of the generator's output for each test case. **Generated, do not edit.** |

## Workflow

```bash
# 1. Add or change a case in multi-entry/ only, then mirror it in single-entry/
npm run sync-fixtures

# 2. Compare the generator's output with the snapshot (CI runs this)
npm test

# 3. If the diff is the intended change, accept it, and commit expected/ with the change
npm run test:update
```

Both fixtures produce the same symbol pages, apart from the import line and "Also exported from".
A difference anywhere else means the generator depends on the library layout.

## Known limitations, pinned on purpose

The snapshot records the current behavior. Fixing one of these shows up as an expected diff.

- Inputs and outputs declared by a mixin are not listed, with a warning (`FxHighlightCard`); the base
  class passed to the mixin is still read.
- Members inherited from a base class of another package are not listed: the page names that class
  (`FxOverlayEvents`, from rxjs's `Subject`).
- Host directives are inherited from base classes of the library (`FxDateTimePicker` gets FxDatePicker's),
  not from a base class of another package.
- An NgModule's `exports` are followed through spreads and constants (`FxButtonModule`); one that cannot
  be resolved is reported. Its `imports`, `declarations` and `providers` are not listed.
- In a template with `${}` substitutions, a constant is replaced with its value; a `select` that depends on
  another value is reported, not listed (`FxDatePicker`).
- An inherited setter input shows its setter's type (`width`), except when that type uses the base
  class's type parameters: then it shows the getter's type, resolved for the subclass (no fixture).
- Exports that get no page are reported as warnings, never dropped silently: the default export,
  `export * as ns` (`fxMath`), a namespace (`FxInternals`) and an unresolvable export (`missingHelper`).
  Symbols re-exported from another package (`booleanAttribute`, `Signal`, `DatePipe`) get a short page.
- Host directives: only the bindings a component exposes are listed (`FxPopover`, `FxDatePicker`). A model
  is two-way on the host only when both halves are exposed with matching names (`expanded`), otherwise
  it is a plain input (`size`) or output (`resized`).

## `--out` safety

The output folder is deleted on every run. The `out-*` cases check that the generator refuses, with
exit code 2, a folder that is or contains the library, or that holds files it did not generate. They
point the generator at copies in a temp folder, so a broken check can never delete the fixtures.
The `extra-docs-*-out` cases do the same for an `--extra-docs` folder inside the output folder, or
containing it. Every case starts from a previous run's output, with a stale `extra-docs/` copy: it must
be accepted, and deleted.

Without `--out`, the docs go into the built package: `<dest>/agent-docs/`, `dest` coming from the
library's `ng-package.json`. The `out-default*` cases build a fake package (just its `package.json`)
next to a copy of `single-entry/`, and check that the docs land there, and that the generator refuses
a library that is not built yet, or a `dest` holding another package. `dest-inside-library` puts
`dest` inside the library, named `my-dist` (standalone ng-packagr layout), with a decoy entry point
in it: the generator must not find it, even with `--out` and the library not built.

## Notes

- These sources are compiled by nothing: they are excluded from `tsconfig.json`, keep them out of any
  linter configuration. `missing-template.html` is missing on purpose, so the folder would not build.
- The root `.gitattributes` forces LF line endings, so the snapshot compares equal on Windows. CRLF
  sources are covered by `crlf-sources`, which converts a copy of `single-entry/` and checks that the
  generated files are the same, byte for byte.
- `dist/`, `node_modules/` and `.cache/` decoys are created by the test runner during the run, not
  committed: git usually ignores those folders.

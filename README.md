# ng-agent-docs

Generates compact, per-symbol API docs from an Angular library's JSDoc, so AI agents read only what
they need instead of the `.d.ts` files.

An agent that needs one input of one component usually reads a whole `.d.ts` file, or the component's
source. `ng-agent-docs` turns the library's public API into small markdown files, shipped inside the
package:

```
agent-docs/index.md                  catalog: one line per symbol, grouped by entry point
agent-docs/api/<entry>/<Symbol>.md   one symbol: import, selector, inputs, outputs, slots, usage, examples
```

The agent reads the index, then only the page it needs.

It works with a single entry point (one `public-api.ts`) and with ng-packagr secondary entry points,
and reads both decorator bindings (`@Input()`, `@Output()`) and signal bindings (`input()`, `model()`,
`output()`).

## Install

```bash
npm install --save-dev ng-agent-docs
```

Node 22 or later.

## Use it in the library build

The docs are generated from the JSDoc, never edited, and written into the built package
(`dist/<lib>/agent-docs/`). They always match the published code, and are never committed.

Run the command **after** `ng build`: ng-packagr empties `dist/<lib>` at the start of every build.
In the workspace's `package.json`:

```json
"scripts": {
  "build:my-lib": "ng build my-lib && ng-agent-docs --root projects/my-lib --strict"
}
```

`--strict` fails the build when the docs are incomplete, so an incomplete package is never published.
Incomplete means a symbol without a description, or an undocumented input, output, or public member of a
service or class. A component's undocumented public methods are not counted: they are template handlers.

There is nothing to add to `ng-package.json`: the folder is written after ng-packagr, next to the
built `package.json`.

## Options

| Option | |
|---|---|
| `--root <dir>` | Library folder, the one containing `ng-package.json` and `package.json`. Required. |
| `--tsconfig <file>` | Default: `<root>/tsconfig.lib.json`. |
| `--out <dir>` | Default: `<dest>/agent-docs`, `dest` coming from `<root>/ng-package.json` (ng-packagr's default: `dist`). Without `--out`, the command stops if the library is not built yet. |
| `--note <text>` | Line added at the top of the index, for the agent. Repeatable. |
| `--strict` | Exit code 1 when documentation is missing (warnings). |

The output folder is deleted and fully regenerated on every run, so removed symbols leave no stale
page. The command refuses an `--out` that is or contains the library or the current folder, or that
holds files it did not generate.

Exit codes: `0` done, `1` warnings with `--strict`, `2` usage error.

## Document the library

Everything comes from the library's sources:

- **Entry points**: every `ng-package.json` under `--root`, and its `lib.entryFile`.
- **Public API**: what each entry file exports. Internal code never appears.
- **Angular metadata**: selector, inputs and outputs (decorators, signals, `inputs`/`outputs` arrays,
  inherited from base classes, exposed by `hostDirectives`), `<ng-content>` slots.
- **Usage**: JSDoc tags on the class.

| Tag | Use |
|---|---|
| first sentence | Short description, shown in the index. |
| `@usage` | When to use it. One tag per case. |
| `@avoid` | When not to use it, and what to use instead. One tag per case. |
| `@replacedBy` | Newer equivalent to prefer in new code (legacy library). |
| `@replaces` | Older elements this one replaces, e.g. `mat-form-field`. |
| `@category` | Read, but not shown in the output yet. |
| `@example` | Code example, fenced (without a fence: an HTML template). Can contain `@if`, `@for` and `@let` blocks. |
| `@deprecated` | Deprecation message. |

An entry point gets a description from a `@packageDocumentation` block at the top of its entry file:

```ts
/** Form fields built on Signal Forms. @packageDocumentation */
```

For a legacy library being replaced, tell agents which library to prefer:

```bash
ng-agent-docs --root projects/legacy-lib --strict \
  --note "Legacy library: in new code, use @acme/ui whenever an equivalent exists (marked ⚠️)."
```

## In the applications that use the library

In their `CLAUDE.md` or `AGENTS.md`:

```md
## @acme/ui
API: read node_modules/@acme/ui/agent-docs/index.md,
then only the relevant api/.../<Symbol>.md file. Do not read the .d.ts files.
```

The `exports` field that ng-packagr writes only limits imports: agents can still read
`node_modules/<package>/agent-docs/` as plain files.

## Development

The command is written in TypeScript (`ng-agent-docs.mts`) and Node runs it directly (22.18 or later),
without a build. The published package contains `dist/ng-agent-docs.mjs` instead, built by `prepack`:
Node does not strip types from files under `node_modules`.

```bash
npm install
npm run typecheck     # strict type check of the command and the test scripts
npm test              # snapshot test on the fixtures (CI)
npm run test:update   # accept an intended change in the output
npm run test:dist     # same snapshot test, on the built dist/ng-agent-docs.mjs
```

Test libraries and expected output are in `test/fixtures/`, see its README.

# FxButtonGroup (directive)

`import { FxButtonGroup } from '@fixtures/single-entry';`

Selector: `[fxButtonGroup]`

Groups buttons and manages a single selection.

## When to use
- Segmented control with two to five options

## Inputs
- `[multiple]: boolean` = `false` — Allows several buttons to be selected at once.

## Outputs
- `(selectionChange): string[]` — Emitted when the selection changes, with the selected values.

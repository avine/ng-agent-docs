# FxSelect (component)

`import { FxSelect } from '@fixtures/multi-entry/forms';`

Selector: `fx-select`

Select field. Its bindings are declared in the decorator metadata (older style), not with decorators.

## Inputs
- `[options]: FxOption<string>[]` = `[]` — Choices shown in the list.
- `[placeholderText]: string | undefined` — Text shown while nothing is selected. Metadata input with an alias.
- `[fxMultiple]: boolean` **required** = `false` · transform: booleanAttribute — Allows several choices. Metadata input in object form.
- `[missingProperty]: unknown`

## Outputs
- `(fxSelectionChange): string[]` — Emitted with the selected values. Metadata output with an alias.

## Content projection (ng-content)
- `default`

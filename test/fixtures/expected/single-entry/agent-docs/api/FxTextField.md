# FxTextField (component)

`import { FxTextField } from '@fixtures/single-entry';`

Selector: `fx-text-field`

Single-line text field. Decorator-based API, as in a legacy library.

## When to use
- Short free text: name, title, reference

## When not to use
- Multi-line text: use a textarea

## Inputs
- `[label]: string` = `''` — Label shown above the field.
- `[placeholderText]: string | undefined` — Text shown while the field is empty. Aliased input.
- `[size]: FxSize | undefined` — Field size. No default value.
- `[fxRequired]: boolean` **required** = `false` · transform: booleanAttribute — Marks the field as required. Object options: alias, required and transform.
- `[dense]: boolean` = `false` ⚠️ deprecated: Use `size="s"`. — Compact layout.
- `[hint]: string` = `''`
- `[maxLength]: string | number` — Maximum number of characters. Input on a setter: the type comes from the parameter.
- `[value]: string` — Current value. Input on a getter.

## Outputs
- `(valueChange): string` — Emitted on each keystroke, with the new value.
- `(fxBlur): FocusEvent` — Emitted when the field loses focus. Aliased output.
- `(changed): string` ⚠️ deprecated: Use `valueChange`. — Old change event.

## Content projection (ng-content)
- `[fxPrefix]`
- `[fxSuffix]`
- `[fxHint]`

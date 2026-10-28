# FxFieldBase (directive)

`import { FxFieldBase } from '@fixtures/single-entry';`

No selector: base class, extend it instead of using it in a template.

Base class of the form fields. Holds the shared inputs.

Abstract directive without a selector, as Angular requires for a base class with inputs.
Generic: a subclass that sets `T` sees its own type on `value`.

## Inputs
- `[label]: string` = `''` — Label of the field.
- `[disabled]: boolean` = `false` · transform: booleanAttribute — Disables the field.
- `[placeholder]: string | undefined` — Text shown while the field is empty. Metadata input of the base class: inherited too.

## Two-way bindings (model)
Each one also works as `[name]` + `(nameChange)`.

- `[(value)]: T | undefined` — Value of the field. Its type comes from the subclass.

# FxFieldBase (directive)

`import { FxFieldBase } from '@fixtures/single-entry';`

No selector: base class, extend it instead of using it in a template.

Base class of the form fields. Holds the shared inputs.

Abstract directive without a selector, as Angular requires for a base class with inputs.
Generic: a subclass that sets `T` sees its own type on `value`.

## Inputs
- `[label]: string` = `''` — Label of the field.
  - **see**: [Labeling controls](https://www.w3.org/WAI/tutorials/forms/labels/), listed under the input, here and on each subclass
- `[disabled]: boolean` = `false` · transform: booleanAttribute — Disables the field.
  - **see**: FxMissingAttribute: warning once, on this page, not on the page of each subclass
- `[width]: string | number` — Width: a number of pixels or a CSS length. The getter always returns a CSS length: an inherited setter input keeps the setter's type.
- `[placeholder]: string | undefined` — Text shown while the field is empty. Metadata input of the base class: inherited too.

## Two-way bindings (model)
Each one also works as `[name]` + `(nameChange)`.

- `[(value)]: T | undefined` — Value of the field. Its type comes from the subclass.

## Public methods (via viewChild or exportAs)
- `focus(): void` — Focuses the field. Inherited: listed on the page of each field.
  - **see**: FxMissingFocus: warning once, on this page, not on the page of each subclass

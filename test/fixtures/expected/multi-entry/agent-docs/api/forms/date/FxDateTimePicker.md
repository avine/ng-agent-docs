# FxDateTimePicker (component)

`import { FxDateTimePicker } from '@fixtures/multi-entry/forms/date';`

Selector: `fx-date-time-picker`

Date and time picker. Two levels of inheritance: FxDatePicker, then FxFieldBase<Date>.
Redeclares `min`, whose own JSDoc replaces the inherited one.

## Inputs
- `[min]: Date | undefined` — Earliest selectable date and time. Redeclared: replaces the inherited `min`.
- `[step]: number` = `15` — Step of the time picker, in minutes.
- `[label]: string` = `''` · inherited from FxFieldBase — Label of the field.
- `[disabled]: boolean` = `false` · transform: booleanAttribute · inherited from FxFieldBase — Disables the field.
- `[width]: string | number` · inherited from FxFieldBase — Width: a number of pixels or a CSS length. The getter always returns a CSS length: an inherited setter input keeps the setter's type.
- `[placeholder]: string | undefined` · inherited from FxFieldBase — Text shown while the field is empty. Metadata input of the base class: inherited too.

## Two-way bindings (model)
Each one also works as `[name]` + `(nameChange)`.

- `[(value)]: Date | undefined` · inherited from FxFieldBase — Value of the field. Its type comes from the subclass.

## Content projection (ng-content)
- `default`

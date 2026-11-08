# FxDateTimePicker (component)

`import { FxDateTimePicker } from '@fixtures/single-entry';`

Selector: `fx-date-time-picker`

Date and time picker. Two levels of inheritance: FxDatePicker, then FxFieldBase<Date>.
Redeclares `min`, whose own JSDoc replaces the inherited one. FxDatePicker's host directive applies
here too: Angular inherits host directives, so its bindings are listed.

## Inputs
- `[min]: Date | undefined` — Earliest selectable date and time. Redeclared: replaces the inherited `min`.
- `[step]: number` = `15` — Step of the time picker, in minutes.
- `[label]: string` = `''` · inherited from FxFieldBase — Label of the field.
- `[disabled]: boolean` = `false` · transform: booleanAttribute · inherited from FxFieldBase — Disables the field.
- `[width]: string | number` · inherited from FxFieldBase — Width: a number of pixels or a CSS length. The getter always returns a CSS length: an inherited setter input keeps the setter's type.
- `[placeholder]: string | undefined` · inherited from FxFieldBase — Text shown while the field is empty. Metadata input of the base class: inherited too.
- `[hint]: string` **required** · from host directive FxTooltip — Text of the tooltip.

## Outputs
- `(tooltipToggle): boolean` · from host directive FxTooltip — Emitted when the tooltip opens or closes.

## Two-way bindings (model)
Each one also works as `[name]` + `(nameChange)`.

- `[(value)]: Date | undefined` · inherited from FxFieldBase — Value of the field. Its type comes from the subclass.

## Host directives
Applied to every instance. Only the bindings listed here can be used in templates.

- [FxTooltip](FxTooltip.md), from base class FxDatePicker: exposes `[hint]`, `(tooltipToggle)`

## Content projection (ng-content)
- `default`

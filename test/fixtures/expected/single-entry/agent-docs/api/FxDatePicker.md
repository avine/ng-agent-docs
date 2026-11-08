# FxDatePicker (component)

`import { FxDatePicker } from '@fixtures/single-entry';`

Selector: `fx-date-picker`

Date picker.

Inherits `label`, `disabled`, `value` (as `Date`) and `placeholder` from FxFieldBase<Date>.
Uses FxTooltip as a host directive, and exposes its text as `hint` and its toggle event as `tooltipToggle`.
Its template contains `${}`: a constant (`PREFIX`) is replaced with its value, so `[fxToday]` and
`[fxFooter]` are listed; the slot selected by `EXTRA_SLOT`, typed `string`, is reported instead.

## Inputs
- `[min]: Date | undefined` — Earliest selectable date.
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

- [FxTooltip](FxTooltip.md): exposes `[hint]`, `(tooltipToggle)`

## Content projection (ng-content)
- `[fxToday]`
- `[fxFooter]`

## Public methods (via viewChild or exportAs)
- `focus(): void` · inherited from FxFieldBase — Focuses the field. Inherited: listed on the page of each field.

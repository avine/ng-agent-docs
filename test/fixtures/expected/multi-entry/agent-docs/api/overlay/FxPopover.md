# FxPopover (component)

`import { FxPopover } from '@fixtures/multi-entry/overlay';`

Selector: `fx-popover`

Popover. Built from host directives only:
- FxRipple, applied but exposing nothing;
- FxAnchor: `open` exposed two-way as `expanded`; `size` as an input only, since its change event is
  renamed `resized`; FxTooltip's text, which FxAnchor exposes, as `tip`; and a typo (`nope`);
- NgStyle, from @angular/common: read from its .d.ts.

## Inputs
- `[size]: "s" | "m" | "l"` = `'m'` · from host directive FxAnchor — Size of the overlay.
- `[tip]: string` **required** · from host directive FxAnchor — Text of the tooltip.
- `[gap]: number` = `8` · from host directive FxAnchor — Distance to the trigger, in pixels.
- `[panelStyle]: { [klass: string]: any; } | null | undefined` · from host directive NgStyle

## Two-way bindings (model)
Each one also works as `[name]` + `(nameChange)`.

- `[(expanded)]: boolean` = `false` · from host directive FxAnchor — Whether the overlay is open.

## Outputs
- `(resized): "s" | "m" | "l"` · from host directive FxAnchor — Size of the overlay.

## Host directives
Applied to every instance. Only the bindings listed here can be used in templates.

- FxRipple (not exported by the library): exposes nothing
- [FxAnchor](FxAnchor.md): exposes `[(expanded)]`, `[size]`, `[tip]`, `[gap]`, `(resized)`
- NgStyle (`@angular/common`): exposes `[panelStyle]`

## Content projection (ng-content)
- `default`

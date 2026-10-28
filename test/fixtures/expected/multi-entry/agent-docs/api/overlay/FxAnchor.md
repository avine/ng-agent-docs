# FxAnchor (directive)

`import { FxAnchor } from '@fixtures/multi-entry/overlay';`

Selector: `[fxAnchor]`

Positions an overlay next to its trigger. Meant to be used as a host directive.
Has a host directive of its own: FxTooltip, whose text it exposes.

## Inputs
- `[offset]: number` = `8` — Distance to the trigger, in pixels.
- `[fxTooltip]: string` **required** · from host directive FxTooltip — Text of the tooltip.

## Two-way bindings (model)
Each one also works as `[name]` + `(nameChange)`.

- `[(open)]: boolean` = `false` — Whether the overlay is open.
- `[(size)]: "s" | "m" | "l"` = `'m'` — Size of the overlay.

## Host directives
Applied to every instance. Only the bindings listed here can be used in templates.

- [FxTooltip](FxTooltip.md): exposes `[fxTooltip]`

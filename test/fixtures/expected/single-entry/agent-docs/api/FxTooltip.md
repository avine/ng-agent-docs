# FxTooltip (directive)

`import { FxTooltip } from '@fixtures/single-entry';`

Selector: `[fxTooltip]` · exportAs: `fxTooltip`

Tooltip shown on hover or focus.

## When to use
- Short hint on an icon-only button

## Inputs
- `[fxTooltip]: string` **required** — Text of the tooltip.
- `[showDelay]: number` = `300` — Delay before showing, in ms. Decorator input mixed with signal inputs.

## Outputs
- `(visibleChange): boolean` — Emitted when the tooltip opens or closes.

## Public methods (via viewChild or exportAs)
- `show(): void` — Shows the tooltip programmatically.

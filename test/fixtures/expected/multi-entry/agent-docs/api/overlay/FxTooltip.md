# FxTooltip (directive)

`import { FxTooltip } from '@fixtures/multi-entry/overlay';`

Selector: `[fxTooltip]` · exportAs: `fxTooltip`

Tooltip shown on hover or focus.

## When to use
- Short hint on an icon-only button

## Inputs
- `[fxTooltip]: string` **required** — Text of the tooltip.
- `[showDelay]: number` = `300` — Delay before showing, in ms. Decorator input mixed with signal inputs.
- `[hideDelay]: number` = `0` · accepts: `string | number` — Delay before hiding, in ms. Inline transform: what it accepts is shown.
- `[distance]: number` = `4` · transform: toPixels · accepts: `string | number` — Distance to the target. Transform of the library: its name and what it accepts are shown.

## Outputs
- `(visibleChange): boolean` — Emitted when the tooltip opens or closes.

## Public methods (via viewChild or exportAs)
- `show(): void` — Shows the tooltip programmatically.

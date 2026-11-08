import { Directive, Input, input, output } from '@angular/core';

/** `8`, `'8'` or `'8px'` → 8. Not exported. */
function toPixels(value: number | string): number {
  return parseFloat(String(value));
}

/**
 * Tooltip shown on hover or focus.
 * @usage Short hint on an icon-only button
 */
@Directive({ selector: '[fxTooltip]', exportAs: 'fxTooltip' })
export class FxTooltip {
  /** Text of the tooltip. */
  readonly fxTooltip = input.required<string>();

  /** Delay before showing, in ms. Decorator input mixed with signal inputs. */
  @Input() showDelay = 300;

  /** Delay before hiding, in ms. Inline transform: what it accepts is shown. */
  readonly hideDelay = input(0, { transform: (value: string | number) => Number(value) });

  /** Distance to the target. Transform of the library: its name and what it accepts are shown. */
  readonly distance = input(4, { transform: toPixels });

  /** Emitted when the tooltip opens or closes. */
  readonly visibleChange = output<boolean>();

  /** Shows the tooltip programmatically. */
  show(): void {}
}

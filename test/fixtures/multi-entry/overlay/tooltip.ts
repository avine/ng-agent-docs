import { Directive, Input, input, output } from '@angular/core';

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

  /** Emitted when the tooltip opens or closes. */
  readonly visibleChange = output<boolean>();

  /** Shows the tooltip programmatically. */
  show(): void {}
}

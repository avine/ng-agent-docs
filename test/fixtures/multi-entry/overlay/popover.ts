import { Component, Directive, input, model } from '@angular/core';
import { NgStyle } from '@angular/common';
import { FxTooltip } from './tooltip';

/** Ripple effect. Not exported by the library: listed without a link. */
@Directive({ selector: '[fxRipple]' })
class FxRipple {}

/**
 * Positions an overlay next to its trigger. Meant to be used as a host directive.
 * Has a host directive of its own: FxTooltip, whose text it exposes.
 */
@Directive({
  selector: '[fxAnchor]',
  hostDirectives: [{ directive: FxTooltip, inputs: ['fxTooltip'] }],
})
export class FxAnchor {
  /** Whether the overlay is open. */
  readonly open = model(false);

  /** Size of the overlay. */
  readonly size = model<'s' | 'm' | 'l'>('m');

  /** Distance to the trigger, in pixels. */
  readonly offset = input(8);
}

/**
 * Popover. Built from host directives only:
 * - FxRipple, applied but exposing nothing;
 * - FxAnchor: `open` exposed two-way as `expanded`; `size` as an input only, since its change event is
 *   renamed `resized`; FxTooltip's text, which FxAnchor exposes, as `tip`; and a typo (`nope`);
 * - NgStyle, from @angular/common: read from its .d.ts.
 */
@Component({
  selector: 'fx-popover',
  template: `<ng-content />`,
  hostDirectives: [
    FxRipple,
    {
      directive: FxAnchor,
      inputs: ['open: expanded', 'size', 'fxTooltip: tip', 'offset: gap', 'nope'],
      outputs: ['openChange: expandedChange', 'sizeChange: resized'],
    },
    { directive: NgStyle, inputs: ['ngStyle: panelStyle'] },
  ],
})
export class FxPopover {}

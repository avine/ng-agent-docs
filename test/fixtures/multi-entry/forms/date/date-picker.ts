import { Component, input } from '@angular/core';
import { FxFieldBase } from '@fixtures/multi-entry/forms';
import { FxTooltip } from '@fixtures/multi-entry/overlay';

const PREFIX = 'fx';
const EXTRA_SLOT: string = '[fxExtra]'; // typed `string`: not a constant for the generator

/**
 * Date picker.
 *
 * Inherits `label`, `disabled`, `value` (as `Date`) and `placeholder` from FxFieldBase<Date>.
 * Uses FxTooltip as a host directive, and exposes its text as `hint` and its toggle event as `tooltipToggle`.
 * Its template contains `${}`: a constant (`PREFIX`) is replaced with its value, so `[fxToday]` and
 * `[fxFooter]` are listed; the slot selected by `EXTRA_SLOT`, typed `string`, is reported instead.
 */
@Component({
  selector: 'fx-date-picker',
  hostDirectives: [{ directive: FxTooltip, inputs: ['fxTooltip: hint'], outputs: ['visibleChange: tooltipToggle'] }],
  template: `<div class="${PREFIX}-date"><ng-content select="[fxToday]" /><ng-content select="[${PREFIX}Footer]" /><ng-content select="${EXTRA_SLOT}" /></div>`,
})
export class FxDatePicker extends FxFieldBase<Date> {
  /** Earliest selectable date. */
  readonly min = input<Date>();
}

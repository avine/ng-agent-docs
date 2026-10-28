import { Component, input } from '@angular/core';
import { FxFieldBase } from '@fixtures/multi-entry/forms';
import { FxTooltip } from '@fixtures/multi-entry/overlay';

const PREFIX = 'fx';

/**
 * Date picker.
 *
 * Inherits `label`, `disabled`, `value` (as `Date`) and `placeholder` from FxFieldBase<Date>.
 * Uses FxTooltip as a host directive, and exposes its text as `hint` and its toggle event as `tooltipToggle`.
 * Its template contains `${}`: no slot is detected (known limitation).
 */
@Component({
  selector: 'fx-date-picker',
  hostDirectives: [{ directive: FxTooltip, inputs: ['fxTooltip: hint'], outputs: ['visibleChange: tooltipToggle'] }],
  template: `<div class="${PREFIX}-date"><ng-content select="[fxToday]" /></div>`,
})
export class FxDatePicker extends FxFieldBase<Date> {
  /** Earliest selectable date. */
  readonly min = input<Date>();
}

import { Component, input } from '@angular/core';
import { FxDatePicker } from './date-picker';

/**
 * Date and time picker. Two levels of inheritance: FxDatePicker, then FxFieldBase<Date>.
 * Redeclares `min`, whose own JSDoc replaces the inherited one.
 */
@Component({ selector: 'fx-date-time-picker', template: `<ng-content />` })
export class FxDateTimePicker extends FxDatePicker {
  /** Earliest selectable date and time. Redeclared: replaces the inherited `min`. */
  override readonly min = input<Date>();

  /** Step of the time picker, in minutes. */
  readonly step = input(15);
}

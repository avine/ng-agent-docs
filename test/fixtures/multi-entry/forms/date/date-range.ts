import { Component, model } from '@angular/core';

/** Date range picker. Its templateUrl points to a missing file: no slots, no crash. */
@Component({ selector: 'fx-date-range', templateUrl: './missing-template.html' })
export class FxDateRange {
  /** Start of the range. */
  readonly start = model<Date>();
}

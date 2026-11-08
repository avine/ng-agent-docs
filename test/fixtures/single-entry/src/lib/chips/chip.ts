import { Component, input } from '@angular/core';

/** Compact element showing a value: a tag, a filter. */
@Component({ selector: 'fx-chip', template: `<ng-content />` })
export class FxChip {
  /** Shows a remove button. */
  readonly removable = input(false);
}

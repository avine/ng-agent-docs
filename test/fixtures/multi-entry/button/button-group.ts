import { Directive, input, output } from '@angular/core';

/**
 * Groups buttons and manages a single selection.
 * @usage Segmented control with two to five options
 */
@Directive({ selector: '[fxButtonGroup]' })
export class FxButtonGroup {
  /** Allows several buttons to be selected at once. */
  readonly multiple = input(false);

  /** Emitted when the selection changes, with the selected values. */
  readonly selectionChange = output<string[]>();
}

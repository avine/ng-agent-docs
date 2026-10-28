import { Component, input } from '@angular/core';

/**
 * Button that only shows an icon.
 * @replaces mat-icon-button
 * @replacedBy `fx-button` with an `aria-label`
 * @deprecated Use FxButton with an icon and `aria-label`.
 */
@Component({ selector: 'fx-icon-button', template: `<ng-content />` })
export class FxIconButton {
  /** Name of the icon. */
  readonly icon = input.required<string>();
}

import { Component, input } from '@angular/core';

// No JSDoc on the class: "missing JSDoc description" warning. No ng-content in the template.
@Component({ selector: 'fx-badge', template: `<span>{{ count() }}</span>` })
export class FxBadge {
  /** Number shown in the badge. */
  readonly count = input(0);

  /** Unit shown after the number. Default value with backticks: the inline code must survive them. */
  readonly unit = input(`items`);
}

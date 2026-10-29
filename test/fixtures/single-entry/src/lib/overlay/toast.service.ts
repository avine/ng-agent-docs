import { Injectable } from '@angular/core';

/**
 * Shows short messages that disappear on their own, at the bottom of the screen and above any
 * open dialog. Provided by the app: no `providedIn`. First sentence wrapped: the index shows all of it.
 */
@Injectable()
export class FxToastService {
  /** Id of the last message shown. Template literal type: its list item keeps one inline code span. */
  lastId?: `fx-toast-${number}`;

  position = 'bottom'; // no JSDoc: "undocumented property" warning

  /** Shows a message for the given duration. */
  show(message: string, durationMs = 3000): void {}
}

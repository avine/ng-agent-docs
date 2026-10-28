import { Injectable } from '@angular/core';

/** Shows short messages that disappear on their own. Provided by the app: no `providedIn`. */
@Injectable()
export class FxToastService {
  /** Shows a message for the given duration. */
  show(message: string, durationMs = 3000): void {}
}

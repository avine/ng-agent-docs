import { Subject } from 'rxjs';

/** Stream of overlay events. Extends rxjs's Subject: named on the page, its members are not listed. */
export class FxOverlayEvents extends Subject<string> {
  /** Emits `open`. */
  open(): void {
    this.next('open');
  }
}

import { Service } from '@angular/core';

/** Blocks page scrolling while an overlay is open. `@Service()` (Angular 22+): listed with the services. */
@Service({ autoProvided: false })
export class FxScrollLock {
  /** Whether scrolling is blocked. */
  locked = false;

  /** Blocks scrolling until `unlock()` is called. */
  lock(): void {}

  /** Lets the page scroll again. */
  unlock(): void {}
}

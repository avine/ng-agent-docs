import { Observable, Subject } from 'rxjs';

/** Handle on an open dialog. Plain class, without an Angular decorator. */
export class FxDialogRef<R = unknown> {
  private readonly closed$ = new Subject<R | undefined>();

  /** Emits once, when the dialog is closed. */
  readonly afterClosed: Observable<R | undefined> = this.closed$.asObservable();

  /** Closes the dialog with an optional result. */
  close(result?: R): void {
    this.closed$.next(result);
  }
}

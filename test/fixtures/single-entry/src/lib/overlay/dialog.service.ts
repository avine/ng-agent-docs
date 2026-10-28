import { Injectable, Injector, OnDestroy, Type, inject, signal } from '@angular/core';
import { FxDialogRef } from './dialog-ref';

/**
 * Opens and tracks dialogs.
 * @usage Confirmation before a destructive action
 */
@Injectable({ providedIn: 'root' })
export class FxDialogService implements OnDestroy {
  private readonly count = signal(0);

  /** Number of open dialogs. */
  readonly openCount = this.count.asReadonly();

  /** Width used when `open()` gets none. Mutable public property. */
  defaultWidth = '480px';

  /** Whether at least one dialog is open. Getter. */
  get hasOpenDialog(): boolean {
    return this.count() > 0;
  }

  private readonly stack: FxDialogRef[] = [];
  protected readonly injector = inject(Injector);
  #opened = 0;
  static readonly maxStack = 5;

  /** Opens a component in a dialog. */
  open<R>(component: Type<unknown>, data?: unknown): FxDialogRef<R> {
    this.#opened++;
    return new FxDialogRef<R>();
  }

  closeAll(): void {} // no JSDoc: still listed, unlike on a component

  private cleanup(): void {}

  /** Lifecycle hook: not listed. */
  ngOnDestroy(): void {}
}

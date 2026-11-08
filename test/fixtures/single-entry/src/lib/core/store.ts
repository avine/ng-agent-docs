import { Injectable, signal } from '@angular/core';
import type { FxOption } from './types';

/** Base of the stores. Exported by no entry point: its members are listed on the pages of its subclasses. */
export abstract class FxStoreBase<T> {
  /** Current items. */
  readonly items = signal<T[]>([]);

  /**
   * Adds an item.
   * @param item Item to add.
   */
  add(item: T): void {
    this.items.update((list) => [...list, item]);
  }

  /** Describes the store. Redeclared by the subclass: listed once, as the subclass declares it. */
  describe(): string {
    return 'store';
  }

  clear(): void {} // no JSDoc: "undocumented method (declared by FxStoreBase)" on the subclass
}

/**
 * Options of the selects. Service with a generic base class: its inherited members are listed, with
 * the base's `T` resolved (`FxOption[]`, not `T[]`).
 */
@Injectable({ providedIn: 'root' })
export class FxOptionStore extends FxStoreBase<FxOption> {
  /** Describes the store. Replaces the inherited one. */
  override describe(): string {
    return 'options';
  }
}

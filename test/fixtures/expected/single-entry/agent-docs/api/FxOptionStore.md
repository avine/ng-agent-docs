# FxOptionStore (service)

`import { FxOptionStore } from '@fixtures/single-entry';`

providedIn: 'root'

Options of the selects. Service with a generic base class: its inherited members are listed, with
the base's `T` resolved (`FxOption[]`, not `T[]`).

## Properties
- `readonly items: WritableSignal<FxOption<string>[]>` · inherited from FxStoreBase — Current items.

## Methods
- `describe(): string` — Describes the store. Replaces the inherited one.
- `add(item: FxOption<string>): void` · inherited from FxStoreBase — Adds an item.
  - `item`: Item to add.
  - **see**: FxMissingItem: warning on the page of FxOptionStore, as FxStoreBase has none
- `clear(): void` · inherited from FxStoreBase

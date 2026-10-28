# FxDialogService (service)

`import { FxDialogService } from '@fixtures/multi-entry/overlay';`

providedIn: 'root'

Opens and tracks dialogs.

## When to use
- Confirmation before a destructive action

## Properties
- `readonly openCount: Signal<number>` — Number of open dialogs.
- `defaultWidth: string` — Width used when `open()` gets none. Mutable public property.
- `hasOpenDialog: boolean` — Whether at least one dialog is open. Getter.

## Methods
- `open<R>(component: Type<unknown>, data?: unknown): FxDialogRef<R>` — Opens a component in a dialog.
- `closeAll(): void`

# FxDialogService (service)

`import { FxDialogService } from '@fixtures/single-entry';`

providedIn: 'root'

Opens and tracks dialogs.

## When to use
- Confirmation before a destructive action

## Properties
- `readonly openCount: Signal<number>` — Number of open dialogs.
- `defaultWidth: string` — Width used when `open()` gets none. Mutable public property.
- `readonly hasOpenDialog: boolean` — Whether at least one dialog is open. Getter.

## Methods
- `open<R>(component: Type<unknown>, data?: unknown): FxDialogRef<R>` — Opens a component in a dialog.
  - `component`: Component shown in the dialog.
  - `data`: Passed to the component, through `FxDialogRef`.
  - **returns**: A reference to close the dialog and read its result.
- `closeAll(): void`

## Static members (`FxDialogService.member`)
- `static readonly maxStack: 5`

# FxDialogService (service)

`import { FxDialogService } from '@fixtures/multi-entry/overlay';`

providedIn: 'root'

Opens and tracks dialogs.

## When to use
- Confirmation before a destructive action

## Properties
- `readonly openCount: Signal<number>` — Number of open dialogs.
- `defaultWidth: string` — Width used when `open()` gets none. Mutable public property.
  - **see**: [Dialog specs](https://m3.material.io/components/dialogs/specs), listed under the property
- `readonly hasOpenDialog: boolean` — Whether at least one dialog is open. Getter.

## Methods
- `open<R>(component: Type<unknown>, data?: unknown): FxDialogRef<R>` — Opens a component in a dialog.
  - `component`: Component shown in the dialog.
  - `data`: Passed to the component, through `FxDialogRef`.
  - **returns**: A reference to close the dialog and read its result.
  - **see**: [FxDialogRef#close](FxDialogRef.md), to close it: listed under the method, after its parameters
- `closeAll(): void`

## Static members (`FxDialogService.member`)
- `static readonly maxStack: 5`

# FxDialogRef (class)

`import { FxDialogRef } from '@fixtures/single-entry';`

Handle on an open dialog. Plain class, without an Angular decorator.

## Properties
- `readonly afterClosed: Observable<R | undefined>` — Emits once, when the dialog is closed.

## Methods
- `close(result?: R): void` — Closes the dialog with an optional result.

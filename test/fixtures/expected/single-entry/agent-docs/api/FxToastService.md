# FxToastService (service)

`import { FxToastService } from '@fixtures/single-entry';`

Shows short messages that disappear on their own, at the bottom of the screen and above any
open dialog. Provided by the app: no `providedIn`. First sentence wrapped: the index shows all of it.

## Properties
- `` lastId: `fx-toast-${number}` | undefined `` — Id of the last message shown. Template literal type: its list item keeps one inline code span.
- `position: string`

## Methods
- `show(message: string, durationMs?: number): void` — Shows a message for the given duration.

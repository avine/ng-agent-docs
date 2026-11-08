# FxScrollLock (service)

`import { FxScrollLock } from '@fixtures/multi-entry/overlay';`

autoProvided: false

Blocks page scrolling while an overlay is open. `@Service()` (Angular 22+): listed with the services.

## Properties
- `locked: boolean` — Whether scrolling is blocked.

## Methods
- `lock(): void` — Blocks scrolling until `unlock()` is called.
- `unlock(): void` — Lets the page scroll again.

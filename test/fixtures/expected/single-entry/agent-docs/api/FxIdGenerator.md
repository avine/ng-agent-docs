# FxIdGenerator (class)

`import { FxIdGenerator } from '@fixtures/single-entry';`

Generates unique ids. Its constructor is private: the page says so.

## Constructor
private: `new FxIdGenerator()` is not available, instances come from the library.

## Methods
- `next(): string` — Next id, e.g. `fx-1`.

## Static members (`FxIdGenerator.member`)
- `static readonly shared: FxIdGenerator` — The instance to use.

# firstDefined (function)

`import { firstDefined } from '@fixtures/multi-entry/core';`

Returns the first defined value. Generic with a constraint and a default.

```ts
firstDefined<T extends object = Record<string, unknown>>(...values: (T | undefined)[]): T | undefined
```

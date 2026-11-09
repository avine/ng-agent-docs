# formatAmount (function)

`import { formatAmount } from '@fixtures/multi-entry/core';`

Formats a number as an amount.

Overloaded function: the JSDoc is on the first overload.

```ts
formatAmount(value: number): string
formatAmount(value: number, currency: string, digits?: number): string
```

## Examples
```ts
formatAmount(12.5); // '12.50 EUR'
```

## See also
- [round](round.md) to round without a currency (`@see` on a function page)

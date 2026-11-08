# FxAmountPipe (pipe)

`import { FxAmountPipe } from '@fixtures/multi-entry/format';`

Template usage: `{{ value | fxAmount }}`

Formats a number as an amount with its currency.

## Signature
```ts
transform(value: number, currency?: string): string
transform(value: null | undefined, currency?: string): null
```

## Parameters
- `value` — Amount to format; `null` or `undefined` gives `null`.
- `currency` — ISO 4217 code, `EUR` by default.

Returns: The amount and its currency, e.g. `12.50 EUR`.

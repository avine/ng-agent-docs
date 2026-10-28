# FxAmountPipe (pipe)

`import { FxAmountPipe } from '@fixtures/single-entry';`

Template usage: `{{ value | fxAmount }}`

Formats a number as an amount with its currency.

## Signature
```ts
transform(value: number, currency?: string): string
transform(value: null | undefined, currency?: string): null
```

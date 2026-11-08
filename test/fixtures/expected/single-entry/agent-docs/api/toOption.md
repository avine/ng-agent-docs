# toOption (function)

`import { toOption } from '@fixtures/single-entry';`

Builds an option from a value.

```ts
toOption<T>(value: T, init?: FxOptionInit): FxOption<T>
```

## Parameters
- `value` — Value sent to the form.
- `init` — Label and state: `FxOptionInit` has no page, a "shows the type" warning.

Returns: The option, ready for `fx-select`.

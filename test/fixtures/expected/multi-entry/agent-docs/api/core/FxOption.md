# FxOption (interface)

`import { FxOption } from '@fixtures/multi-entry/core';`

One choice in a select or a radio group.

```ts
export interface FxOption<T = string> {
  /** Value sent to the form. */
  value: T;
  /** Text shown to the user. */
  label: string;
  disabled?: boolean;
}
```

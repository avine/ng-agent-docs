# FxGroup (interface)

`import { FxGroup } from '@fixtures/single-entry';`

Options shown under a heading. Extends `FxGroupBase`, which has no page: a "shows the type" warning.

```ts
export interface FxGroup<T = string> extends FxGroupBase {
  options: FxOption<T>[];
}
```

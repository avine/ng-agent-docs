# FxDefaults (interface)

`import { FxDefaults } from '@fixtures/single-entry';`

Default values applied when an input is not set.

```ts
export interface FxDefaults {
  size: FxSize;
  tone: FxTone;
}
```

---

# FxDefaults (const)

`import { FxDefaults } from '@fixtures/single-entry';`

Library-wide defaults. Same name as the interface: both are merged into one file.

```ts
const FxDefaults: FxDefaults;
```

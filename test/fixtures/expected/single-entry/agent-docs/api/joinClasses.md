# joinClasses (function)

`import { joinClasses } from '@fixtures/single-entry';`

Joins CSS classes, skipping falsy values. Optional parameter followed by a rest parameter.

```ts
joinClasses(separator?: string, ...classes: (string | false | null | undefined)[]): string
```

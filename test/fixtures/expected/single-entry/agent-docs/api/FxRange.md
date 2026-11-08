# FxRange (class)

`import { FxRange } from '@fixtures/single-entry';`

Range of numbers, bounds included. Plain class: its constructor and static members are listed.

## Constructor
- `new FxRange(min: number, max?: number)` — Creates a range.
  - `min`: Lower bound.
  - `max`: Upper bound, `min` by default.

## Properties
- `readonly size: number` — Number of values. Getter without a setter: listed as read-only.
- `readonly min: number` — constructor parameter
- `readonly max: number` — constructor parameter

## Static members (`FxRange.member`)
- `static readonly EMPTY: FxRange` — Range with no value. Static property.
- `static parse(text: string): FxRange` — Reads a range written `min..max`.
  - `text`: e.g. `1..5`.

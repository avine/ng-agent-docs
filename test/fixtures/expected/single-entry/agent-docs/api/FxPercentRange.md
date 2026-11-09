# FxPercentRange (class)

`import { FxPercentRange } from '@fixtures/single-entry';`

Range of percentages. Inherits its constructor, members and static members from FxRange, which has a page.

## Constructor
- `new FxPercentRange(min: number, max?: number)` · inherited from FxRange — Creates a range.
  - `min`: Lower bound.
  - `max`: Upper bound, `min` by default.
  - **see**: [FxRange.parse](FxRange.md), to read a range from text: listed under the constructor, here and on FxPercentRange

## Properties
- `readonly valid: boolean` — Whether the range stays within 0..100.
- `readonly size: number` · inherited from FxRange — Number of values. Getter without a setter: listed as read-only.
- `readonly min: number` · inherited from FxRange — constructor parameter
- `readonly max: number` · inherited from FxRange — constructor parameter

## Static members (`FxPercentRange.member`)
- `static readonly EMPTY: FxRange` · inherited from FxRange — Range with no value. Static property.
- `static parse(text: string): FxRange` · inherited from FxRange — Reads a range written `min..max`.
  - `text`: e.g. `1..5`.

/** Range of numbers, bounds included. Plain class: its constructor and static members are listed. */
export class FxRange {
  /**
   * Creates a range.
   * @param min Lower bound.
   * @param max - Upper bound, `min` by default.
   */
  constructor(
    readonly min: number,
    readonly max = min,
  ) {}

  /** Range with no value. Static property. */
  static readonly EMPTY = new FxRange(0, -1);

  /**
   * Reads a range written `min..max`.
   * @param text e.g. `1..5`.
   */
  static parse(text: string): FxRange {
    const [min = 0, max = min] = text.split('..').map(Number);
    return new FxRange(min, max);
  }

  /** Number of values. Getter without a setter: listed as read-only. */
  get size(): number {
    return Math.max(0, this.max - this.min + 1);
  }
}

/** Generates unique ids. Its constructor is private: the page says so. */
export class FxIdGenerator {
  private constructor() {}

  /** The instance to use. */
  static readonly shared = new FxIdGenerator();

  private count = 0;

  /** Next id, e.g. `fx-1`. */
  next(): string {
    return `fx-${++this.count}`;
  }
}

/** Range of percentages. Inherits its constructor, members and static members from FxRange, which has a page. */
export class FxPercentRange extends FxRange {
  /** Whether the range stays within 0..100. */
  get valid(): boolean {
    return this.min >= 0 && this.max <= 100;
  }
}

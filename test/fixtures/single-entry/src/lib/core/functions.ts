/** Predicate on a value. */
export type FxPredicate<T> = (value: T) => boolean;

/**
 * Formats a number as an amount.
 *
 * Overloaded function: the JSDoc is on the first overload.
 * @category Formatting
 * @example
 * ```ts
 * formatAmount(12.5); // '12.50 EUR'
 * ```
 */
export function formatAmount(value: number): string;
export function formatAmount(value: number, currency: string, digits?: number): string;
export function formatAmount(value: number, currency = 'EUR', digits = 2): string {
  return `${value.toFixed(digits)} ${currency}`;
}

/** Returns the first defined value. Generic with a constraint and a default. */
export function firstDefined<T extends object = Record<string, unknown>>(...values: (T | undefined)[]): T | undefined {
  return values.find((v) => v !== undefined);
}

/** Joins CSS classes, skipping falsy values. Optional parameter followed by a rest parameter. */
export function joinClasses(separator?: string, ...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(separator ?? ' ');
}

/** Clamps a value between two bounds. Arrow function with default parameters. */
export const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));

/** Loads a JSON document. Async arrow function with a generic. */
export const loadJson = async <T>(url: string): Promise<T> => (await fetch(url)).json() as Promise<T>;

/** Rounds a number. Function expression. */
export const round = function (value: number, digits = 0): number {
  return Math.round(value * 10 ** digits) / 10 ** digits;
};

/** Does nothing. Arrow function in parentheses, with `satisfies`. */
export const noop = (() => {}) satisfies () => void;

/** Returns its argument. Arrow function with an `as` cast: documented as a const of the asserted type. */
export const identity = (<T>(value: T) => value) as <T>(value: T) => T;

/** Tells whether a string is empty. Arrow function in parentheses only. */
export const isEmpty = ((value: string): boolean => value.length === 0);

/** Tells whether a number is even. Typed on the variable: documented with that type, as in the .d.ts. */
export const isEven: FxPredicate<number> = (n) => n % 2 === 0;

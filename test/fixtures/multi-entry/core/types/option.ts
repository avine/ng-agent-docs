import type { FxGroupBase } from '../internal';
import { FxSize, FxTone } from './size';

/** One choice in a select or a radio group. */
export interface FxOption<T = string> {
  /** Value sent to the form. */
  value: T;
  /** Text shown to the user. */
  label: string;
  disabled?: boolean;
}

/** Default values applied when an input is not set. */
export interface FxDefaults {
  size: FxSize;
  tone: FxTone;
}

/** Library-wide defaults. Same name as the interface: both are merged into one file. */
export const FxDefaults: FxDefaults = { size: 'm', tone: FxTone.Neutral };

/** Options shown under a heading. Extends `FxGroupBase`, which has no page: a "shows the type" warning. */
export interface FxGroup<T = string> extends FxGroupBase {
  options: FxOption<T>[];
}

/** Comparison function used to match options. */
export type FxCompareWith<T> = (a: T, b: T) => boolean;

// Namespace export: ignored by the generator.
export namespace FxInternals {
  export const version = 1;
}

import type { FxSize } from './types/size';

/**
 * Default size, as a value. Its name differs from the type `FxSize` only by case: its page is
 * `fxSize-2.md`, so both pages stay apart on a case-insensitive file system.
 */
export const fxSize: FxSize = 'm';

/** Default number of rows per page. */
export const FX_PAGE_SIZE = 20;

/** Breakpoints, in pixels. */
export const FX_BREAKPOINTS = { mobile: 600, tablet: 960, desktop: 1280 } as const;

export interface FxTheme {
  accent: string;
}

/**
 * Default theme. The interface of the same name has no JSDoc: this description makes the index line,
 * and this part comes first on the page.
 */
export const FxTheme: FxTheme = { accent: 'blue' };

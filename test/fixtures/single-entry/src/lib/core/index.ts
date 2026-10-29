/**
 * Shared types, tokens and helpers used by every other entry point.
 *
 * Second paragraph: shown nowhere, the index only keeps the first sentence.
 * @packageDocumentation
 */
export * from './types';
export * from './tokens';
export * from './functions';
export * from './constants';
// Renamed export: documented as `fxCssClass`, not `buildCssClass`.
export { buildCssClass as fxCssClass } from './internal';
// Namespace re-export: not supported, the generator must warn instead of dropping it silently.
export * as fxMath from './math';
// Re-exports from other packages: a short page pointing to that package.
export { booleanAttribute } from '@angular/core';
export type { Signal } from '@angular/core';
export { DatePipe } from '@angular/common';

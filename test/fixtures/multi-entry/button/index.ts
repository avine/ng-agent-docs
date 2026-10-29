/** Buttons and button groups. @packageDocumentation */
export * from './button';
export * from './button-group';
export * from './icon-button';
export * from './badge';
// Re-export from another entry point: documented once, in core, with "Also exported from".
export type { FxSize } from '@fixtures/multi-entry/core';
// Renamed re-export, read before core's own export: the page keeps core's name and import line,
// and lists this name in "Also exported from".
export { FxTone as FxButtonTone } from '@fixtures/multi-entry/core';

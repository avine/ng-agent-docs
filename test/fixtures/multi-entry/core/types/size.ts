/** Size scale shared by every component. */
export type FxSize = 's' | 'm' | 'l';

/**
 * Visual tone of a component.
 *
 * Drives the color and the icon.
 */
export enum FxTone {
  Neutral = 'neutral',
  Success = 'success',
  Warning = 'warning',
  Danger = 'danger',
}

/** Spacing density. A const enum, inlined at compile time. */
export const enum FxDensity {
  Compact,
  Comfortable,
}

// No JSDoc at all: documented without a description.
export type FxId = string | number;

/** Outdated comment: must NOT be used, only the last block counts. */
/** Unique identifier of a persisted entity. */
export type FxEntityId = `${string}-${number}`;

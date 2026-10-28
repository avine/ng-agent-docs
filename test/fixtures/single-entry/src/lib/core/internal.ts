/** Builds a BEM-like CSS class. Exported by core/index.ts under another name. */
export function buildCssClass(block: string, modifier?: string): string {
  return modifier ? `${block}--${modifier}` : block;
}

/** Exported by this file but by no entry point: must never be documented. */
export function internalHelper(): void {}

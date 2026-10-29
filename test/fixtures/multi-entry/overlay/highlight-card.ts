import { Component, Directive, input } from '@angular/core';

type Constructor<T = object> = new (...args: any[]) => T;

// Mixin, as older Angular Material used: the base class is the result of a function call.
function withHighlight<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    /** Declared by the mixin: not documented, the generator warns. */
    readonly highlighted = input(false);
  };
}

/** Base class passed to the mixin. */
@Directive()
class CardBase {
  /** Shadow depth, from 0 to 5. Declared by the base passed to the mixin: documented as inherited. */
  readonly elevation = input(1);

  readonly outlined = input(false); // no JSDoc, and CardBase has no page: reported on FxHighlightCard
}

/** Card built on a mixin: inherits `elevation` from CardBase, and gets a warning for the mixin's own bindings. */
@Component({ selector: 'fx-highlight-card', template: `<ng-content />` })
export class FxHighlightCard extends withHighlight(CardBase) {}

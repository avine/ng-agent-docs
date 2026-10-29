import { booleanAttribute, Directive, Input, input, model } from '@angular/core';

/**
 * Base class of the form fields. Holds the shared inputs.
 *
 * Abstract directive without a selector, as Angular requires for a base class with inputs.
 * Generic: a subclass that sets `T` sees its own type on `value`.
 */
@Directive({ inputs: ['placeholder'] })
export abstract class FxFieldBase<T = unknown> {
  /** Label of the field. */
  readonly label = input('');

  /** Disables the field. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Value of the field. Its type comes from the subclass. */
  readonly value = model<T>();

  /** Text shown while the field is empty. Metadata input of the base class: inherited too. */
  placeholder?: string;

  /**
   * Width: a number of pixels or a CSS length. The getter always returns a CSS length: an inherited
   * setter input keeps the setter's type.
   */
  @Input()
  set width(value: string | number) {
    this.cssWidth = typeof value === 'number' ? `${value}px` : value;
  }
  get width(): string {
    return this.cssWidth;
  }
  private cssWidth = 'auto';
}

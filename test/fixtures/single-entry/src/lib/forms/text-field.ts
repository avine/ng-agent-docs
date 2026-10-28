import { booleanAttribute, Component, EventEmitter, Input, Output } from '@angular/core';
import { FxSize } from '../core';

/**
 * Single-line text field. Decorator-based API, as in a legacy library.
 * @usage Short free text: name, title, reference
 * @avoid Multi-line text: use a textarea
 */
@Component({
  selector: 'fx-text-field',
  templateUrl: './text-field.html',
})
export class FxTextField {
  /** Label shown above the field. */
  @Input() label = '';

  /** Text shown while the field is empty. Aliased input. */
  @Input('placeholderText') placeholder?: string;

  /** Field size. No default value. */
  @Input() size?: FxSize;

  /** Marks the field as required. Object options: alias, required and transform. */
  @Input({ alias: 'fxRequired', required: true, transform: booleanAttribute }) isRequired = false;

  /** Maximum number of characters. Input on a setter: the type comes from the parameter. */
  @Input() set maxLength(value: number | string) {
    this._maxLength = Number(value);
  }
  private _maxLength = 0;

  /** Current value. Input on a getter. */
  @Input() get value(): string {
    return this._value;
  }
  set value(v: string) {
    this._value = v;
  }
  private _value = '';

  /**
   * Compact layout.
   * @deprecated Use `size="s"`.
   */
  @Input() dense = false;

  @Input() hint = ''; // no JSDoc: "undocumented input" warning

  /** Emitted on each keystroke, with the new value. */
  @Output() valueChange = new EventEmitter<string>();

  /** Emitted when the field loses focus. Aliased output. */
  @Output('fxBlur') blurred = new EventEmitter<FocusEvent>();

  /**
   * Old change event.
   * @deprecated Use `valueChange`.
   */
  @Output() changed = new EventEmitter<string>();
}

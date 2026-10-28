import { booleanAttribute, Component, EventEmitter } from '@angular/core';
import { FxOption } from '@fixtures/multi-entry/core';

/**
 * Select field. Its bindings are declared in the decorator metadata (older style), not with decorators.
 */
@Component({
  selector: 'fx-select',
  template: `<ng-content />`,
  inputs: [
    'options',
    'placeholder: placeholderText',
    { name: 'multiple', alias: 'fxMultiple', required: true, transform: booleanAttribute },
    'missingProperty',
  ],
  outputs: ['selectionChange: fxSelectionChange'],
})
export class FxSelect {
  /** Choices shown in the list. */
  options: FxOption[] = [];

  /** Text shown while nothing is selected. Metadata input with an alias. */
  placeholder?: string;

  /** Allows several choices. Metadata input in object form. */
  multiple = false;

  /** Emitted with the selected values. Metadata output with an alias. */
  selectionChange = new EventEmitter<string[]>();
}

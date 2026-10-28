import { booleanAttribute, Component, input, model, numberAttribute, OnInit, output } from '@angular/core';
import { outputFromObservable } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { FxSize, FxTone } from '../core';

/** Visual style of a button. */
export type FxButtonVariant = 'filled' | 'outlined' | 'text';

/**
 * Action button.
 *
 * Second paragraph: shown on the symbol page, not in the index.
 *
 * @usage Primary action of a form or a dialog
 * @usage Secondary action, with variant="outlined"
 * @avoid Navigation to another page: use a link
 * @avoid Toggling a state: use a toggle
 * @replaces mat-button
 * @replaces mat-flat-button
 * @example
 * ```html
 * <fx-button variant="filled" (pressed)="save()">Save</fx-button>
 * ```
 * @example
 * <fx-button [loading]="saving()">
 *   @if (saving()) {
 *     <span fxButtonIcon>⏳</span>
 *   }
 *   Save
 * </fx-button>
 */
@Component({
  selector: 'fx-button',
  exportAs: 'fxButton',
  template: `
    <ng-content select="[fxButtonIcon]" />
    <ng-content></ng-content>
    <ng-content select='[fxButtonSuffix]'/>
    <ng-content select="[fxButtonIcon]" />
  `,
})
export class FxButton implements OnInit {
  // --- Signal inputs --------------------------------------------------------
  /** Visual style. */
  readonly variant = input<FxButtonVariant>('filled');

  /** Size. Its type is an alias declared in another entry point. */
  readonly size = input<FxSize>('m');

  /** Tone. No default value. */
  readonly tone = input<FxTone>();

  /** Accessible label, required when the button only has an icon. Required + alias. */
  readonly ariaLabel = input.required<string>({ alias: 'aria-label' });

  /** Shows a spinner and blocks clicks. Accepts the bare attribute: `<fx-button loading>`. */
  readonly loading = input(false, { transform: booleanAttribute });

  /** Position in the tab order. Alias + transform. */
  readonly tabOrder = input(0, { alias: 'tabindex', transform: numberAttribute });

  /** Extra data sent to analytics. Multi-line default value, collapsed to one line. */
  readonly tracking = input<{ category: string; action: string }>({
    category: 'button',
    action: 'click',
  });

  /**
   * Old name of `variant`.
   * @deprecated Use `variant`. Removed in v3.
   */
  readonly kind = input<FxButtonVariant>();

  readonly iconPosition = input<'start' | 'end'>('start'); // no JSDoc: "undocumented input" warning

  // --- Models ---------------------------------------------------------------
  /** Pressed state of a toggle button. */
  readonly active = model(false);

  /** Value of the button inside a group. No default value. */
  readonly value = model<string>();

  /** Selected state. Required two-way binding. */
  readonly selected = model.required<boolean>();

  // --- Outputs --------------------------------------------------------------
  /** Emitted on click, unless the button is loading. */
  readonly pressed = output<MouseEvent>();

  /** Emitted when the button gets focus. */
  readonly focused = output<void>();

  /** Emitted after a long press, with its duration in ms. Aliased output. */
  readonly longPress = output<number>({ alias: 'fxLongPress' });

  private readonly hover$ = new Subject<boolean>();

  /** Emitted when the pointer enters or leaves. Built from an observable. */
  readonly hovered = outputFromObservable(this.hover$);

  /** Same as `hovered`, aliased. */
  readonly hoverChange = outputFromObservable(this.hover$, { alias: 'fxHoverChange' });

  /**
   * Old click event.
   * @deprecated Use `pressed`.
   */
  readonly clicked = output<MouseEvent>();

  // --- Methods --------------------------------------------------------------
  /** Gives focus to the button. Overloaded method: the JSDoc is on the first overload. */
  focus(): void;
  focus(options: FocusOptions): void;
  focus(options?: FocusOptions): void {}

  /** Shows the loading state while an action runs. Generic method. */
  run<T>(action: () => Promise<T>): Promise<T> {
    return action();
  }

  /** Plays a ripple effect at each point. Rest parameter. */
  ripple(...points: { x: number; y: number }[]): void {}

  /** Announces a message to screen readers. Optional parameter. */
  announce(message: string, politeness?: 'polite' | 'assertive'): void {}

  // Public but without JSDoc: considered a template handler, not listed.
  onClick(event: MouseEvent): void {}

  /** Private method: not listed. */
  private log(): void {}

  /** Protected method: not listed. */
  protected track(): void {}

  /** ECMAScript private method: not listed. */
  #reset(): void {}

  /** Static method: not listed. */
  static isButton(value: unknown): value is FxButton {
    return value instanceof FxButton;
  }

  /** Lifecycle hook: not listed, even with a JSDoc. */
  ngOnInit(): void {}
}

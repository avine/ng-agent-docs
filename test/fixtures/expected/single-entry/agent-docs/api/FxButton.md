# FxButton (component)

`import { FxButton } from '@fixtures/single-entry';`

Selector: `fx-button` · exportAs: `fxButton`

Replaces: mat-button, mat-flat-button

Action button.

Second paragraph: shown on the symbol page, not in the index.

## When to use
- Primary action of a form or a dialog
- Secondary action, with variant="outlined"

## When not to use
- Navigation to another page: use a link
- Toggling a state: use a toggle

## Inputs
- `[variant]: FxButtonVariant` = `'filled'` — Visual style.
- `[size]: FxSize` = `'m'` — Size. Its type is an alias declared in another entry point.
- `[tone]: FxTone | undefined` — Tone. No default value.
- `[aria-label]: string` **required** — Accessible label, required when the button only has an icon. Required + alias.
- `[loading]: boolean` = `false` · transform: booleanAttribute — Shows a spinner and blocks clicks. Accepts the bare attribute: `<fx-button loading>`.
- `[tabindex]: number` = `0` · transform: numberAttribute — Position in the tab order. Alias + transform.
- `[tracking]: { category: string; action: string; }` = `{ category: 'button', action: 'click', }` — Extra data sent to analytics. Multi-line default value, collapsed to one line.
- `[kind]: FxButtonVariant | undefined` ⚠️ deprecated: Use `variant`. Removed in v3. — Old name of `variant`.
- `[iconPosition]: "start" | "end"` = `'start'`

## Outputs
- `(pressed): MouseEvent` — Emitted on click, unless the button is loading.
- `(focused): void` — Emitted when the button gets focus.
- `(fxLongPress): number` — Emitted after a long press, with its duration in ms. Aliased output.
- `(hovered): boolean` — Emitted when the pointer enters or leaves. Built from an observable.
- `(fxHoverChange): boolean` — Same as `hovered`, aliased.
- `(clicked): MouseEvent` ⚠️ deprecated: Use `pressed`. — Old click event.

## Two-way bindings (model)
Each one also works as `[name]` + `(nameChange)`.

- `[(active)]: boolean` = `false` — Pressed state of a toggle button.
- `[(value)]: string | undefined` — Value of the button inside a group. No default value.
- `[(selected)]: boolean` **required** — Selected state. Required two-way binding.

## Content projection (ng-content)
- `[fxButtonIcon]`
- `default`
- `[fxButtonSuffix]`

## Public methods (via viewChild or exportAs)
- `focus(): void` — Gives focus to the button. Overloaded method: the JSDoc is on the first overload.
- `focus(options: FocusOptions): void` — Gives focus to the button. Overloaded method: the JSDoc is on the first overload.
- `run<T>(action: () => Promise<T>): Promise<T>` — Shows the loading state while an action runs. Generic method.
- `ripple(...points: { x: number; y: number; }[]): void` — Plays a ripple effect at each point. Rest parameter.
- `announce(message: string, politeness?: "polite" | "assertive"): void` — Announces a message to screen readers. Optional parameter.

## Examples
```html
<fx-button variant="filled" (pressed)="save()">Save</fx-button>
```
```html
<fx-button [loading]="saving()">
  @if (saving()) {
    <span fxButtonIcon>⏳</span>
  }
  Save
</fx-button>
```

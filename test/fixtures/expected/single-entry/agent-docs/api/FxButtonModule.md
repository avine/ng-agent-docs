# FxButtonModule (module)

`import { FxButtonModule } from '@fixtures/single-entry';`

The buttons as an NgModule, for applications still built on modules.
Its `exports` are listed, linked to their pages; its static `forRoot()` too.

## Exports
Usable in the templates of the components that import this module.

- [FxButton](FxButton.md) `fx-button`
- [FxIconButton](FxIconButton.md) `fx-icon-button`
- [FxBadge](FxBadge.md) `fx-badge`
- CommonModule (`@angular/common`)
- FxButtonRipple (not exported by the library) `[fxButtonRipple]`

## Static members (`FxButtonModule.member`)
- `static forRoot(config: FxButtonConfig): ModuleWithProviders<FxButtonModule>` — Configures the buttons for the whole application. Call it once, in the root module.
  - `config`: Defaults applied to every button.

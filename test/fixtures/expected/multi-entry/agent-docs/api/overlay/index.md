# `@fixtures/multi-entry/overlay`

Dialogs, tooltips and toasts.

Import each symbol from `@fixtures/multi-entry/overlay`. Read only the relevant `<Symbol>.md` file.

## Components
- [FxConfirmDialog](FxConfirmDialog.md) — Content of a confirmation dialog, opened with FxDialogService.
- [FxHighlightCard](FxHighlightCard.md) `fx-highlight-card` — Card built on a mixin: inherits `elevation` from CardBase, and gets a warning for the mixin's own bindings.
- [FxPopover](FxPopover.md) `fx-popover` — Popover.
- [FxStyledPanel](FxStyledPanel.md) `fx-styled-panel` — Panel that extends a directive from another package: its inherited bindings are read from the .d.ts.

## Directives
- [FxAnchor](FxAnchor.md) `[fxAnchor]` — Positions an overlay next to its trigger.
- [FxTooltip](FxTooltip.md) `[fxTooltip]` — Tooltip shown on hover or focus.

## Services
- [FxDialogService](FxDialogService.md) — Opens and tracks dialogs.
- [FxLiveAnnouncer](FxLiveAnnouncer.md) — Announces messages to screen readers.
- [FxScrollLock](FxScrollLock.md) — Blocks page scrolling while an overlay is open. `@Service()` (Angular 22+): listed with the services.
- [FxToastService](FxToastService.md) — Shows short messages that disappear on their own, at the bottom of the screen and above any open dialog.

## Functions, constants and classes
- [FxDialogRef](FxDialogRef.md) — Handle on an open dialog.
- [FxOverlayBase](FxOverlayBase.md) — Base class of the overlays.
- [FxOverlayEvents](FxOverlayEvents.md) — Stream of overlay events.

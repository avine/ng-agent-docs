import { NgModule, type ModuleWithProviders, Directive } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FxBadge } from './badge';
import { FxButton } from './button';
import { FxIconButton } from './icon-button';

/** Ripple of the buttons. Exported by the module but by no entry point: a "has no page" warning. */
@Directive({ selector: '[fxButtonRipple]' })
class FxButtonRipple {}

// Not exported: only spread into the module's arrays, which are followed through it.
const FX_BUTTONS = [FxButton, FxIconButton] as const;

/** Defaults applied to every button. */
export interface FxButtonConfig {
  /** Shape of the corners. */
  rounded: boolean;
}

/**
 * The buttons as an NgModule, for applications still built on modules.
 * Its `exports` are listed, linked to their pages; its static `forRoot()` too.
 */
@NgModule({
  imports: [...FX_BUTTONS, FxBadge, FxButtonRipple],
  exports: [...FX_BUTTONS, FxBadge, CommonModule, FxButtonRipple],
})
export class FxButtonModule {
  /**
   * Configures the buttons for the whole application. Call it once, in the root module.
   * @param config Defaults applied to every button.
   */
  static forRoot(config: FxButtonConfig): ModuleWithProviders<FxButtonModule> {
    return { ngModule: FxButtonModule, providers: [{ provide: 'FX_BUTTON_CONFIG', useValue: config }] };
  }
}

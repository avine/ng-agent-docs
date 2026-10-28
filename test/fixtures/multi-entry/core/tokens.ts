import { InjectionToken } from '@angular/core';
import { FxDefaults } from './types';

/** Overrides the library defaults for a part of the app. */
export const FX_DEFAULTS = new InjectionToken<FxDefaults>('FX_DEFAULTS');

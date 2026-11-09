import { Component } from '@angular/core';
import { NgStyle } from '@angular/common';
import { FxSize } from '../core';
import { internalHelper } from '../core/internal';
import { FxDialogRef } from './dialog-ref';
import { FxDialogService } from './dialog.service';

/**
 * Content of a confirmation dialog, opened with FxDialogService. A component without a selector: created from code.
 *
 * Tests the `@see` tags: a symbol of the library is linked to its page, a member to its class's page,
 * wherever it is declared (imported in this file: TypeScript resolves each name as for "Go to definition").
 * A tag can follow text on its line. @see FxDialogService
 * @see {@link FxDialogService.open | Opening a dialog}, then {@linkcode FxDialogRef#close} (JSDoc member syntax)
 * @see {@link FxSize} for the sizes, from another entry point
 * @see {@link NgStyle} from another package: not linked
 * @see {@link internalHelper}, exported by no entry point: warning
 * @see {@link FxMissingDialog} not imported, or misspelled: warning
 * @see https://m3.material.io/components/dialogs
 * @see {@link https://angular.dev/best-practices/a11y | Accessibility guide}
 * @see the theming guide, in the extra docs: free text, kept as written
 */
@Component({ template: `<p>Are you sure?</p>` })
export class FxConfirmDialog {}

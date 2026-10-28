import { Component } from '@angular/core';
import { NgStyle } from '@angular/common';

/** Panel that extends a directive from another package: its inherited bindings can't be read from a .d.ts. */
@Component({ selector: 'fx-styled-panel', template: `<ng-content />` })
export class FxStyledPanel extends NgStyle {}

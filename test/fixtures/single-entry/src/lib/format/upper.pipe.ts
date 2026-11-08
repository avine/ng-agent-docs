import { Pipe, PipeTransform } from '@angular/core';

const UPPER = 'fxUpper';

/** Upper-cases a text. Its name is a constant, not a string literal: a warning, no template usage line. */
@Pipe({ name: UPPER })
export class FxUpperPipe implements PipeTransform {
  transform(value: string): string {
    return value.toUpperCase();
  }
}

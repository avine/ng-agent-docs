import { Pipe, PipeTransform } from '@angular/core';

/** Formats a number as an amount with its currency. */
@Pipe({ name: 'fxAmount' })
export class FxAmountPipe implements PipeTransform {
  transform(value: number, currency?: string): string;
  transform(value: null | undefined, currency?: string): null;
  transform(value: number | null | undefined, currency = 'EUR'): string | null {
    return value == null ? null : `${value.toFixed(2)} ${currency}`;
  }
}

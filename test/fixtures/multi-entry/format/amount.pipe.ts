import { Pipe, PipeTransform } from '@angular/core';

/** Formats a number as an amount with its currency. */
@Pipe({ name: 'fxAmount' })
export class FxAmountPipe implements PipeTransform {
  /**
   * Formats the value.
   * @param value Amount to format; `null` or `undefined` gives `null`.
   * @param currency - ISO 4217 code, `EUR` by default.
   * @returns The amount and its currency, e.g. `12.50 EUR`.
   */
  transform(value: number, currency?: string): string;
  transform(value: null | undefined, currency?: string): null;
  transform(value: number | null | undefined, currency = 'EUR'): string | null {
    return value == null ? null : `${value.toFixed(2)} ${currency}`;
  }
}

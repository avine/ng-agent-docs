/**
 * Rounds a number to a given number of decimals. In the folder of the utils entry point, but outside the
 * src/ folder of its entry file: utils owns it with either builder (no warning, a page under utils).
 */
export const roundTo = (value: number, decimals: number): number => Number(value.toFixed(decimals));

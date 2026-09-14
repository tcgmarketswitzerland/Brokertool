/**
 * Geldbetraege sind Ganzzahlen in Rappen (Datenbankstruktur 1.1).
 * Rundungsfehler in einer Versorgungsluecke sind fachlich inakzeptabel,
 * deshalb nie Gleitkomma.
 */

declare const rappenBrand: unique symbol;
export type Rappen = number & { readonly [rappenBrand]: true };

export function rappen(value: number): Rappen {
  if (!Number.isInteger(value)) throw new Error('Rappen muessen ganzzahlig sein');
  if (!Number.isSafeInteger(value)) throw new Error('Betrag ausserhalb des sicheren Zahlenbereichs');
  return value as Rappen;
}

export function fromFranken(franken: number): Rappen {
  return rappen(Math.round(franken * 100));
}

export function add(...values: readonly Rappen[]): Rappen {
  return rappen(values.reduce<number>((sum, v) => sum + v, 0));
}

export function subtract(a: Rappen, b: Rappen): Rappen {
  return rappen(a - b);
}

/** Nie negativ: eine Versorgungsluecke ist null oder positiv, nie ein Ueberschuss. */
export function clampToZero(value: Rappen): Rappen {
  return rappen(Math.max(0, value));
}

export function formatCHF(value: Rappen, locale = 'de-CH'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'CHF', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value / 100);
}

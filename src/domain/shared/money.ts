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

/**
 * Betrag in Schweizer Schreibweise: Tausendertrennung mit Apostroph,
 * Rappen nur, wenn welche da sind.
 *
 * Von Hand und nicht ueber Intl: dieselbe Zahl muss auf dem Server und im
 * Browser Zeichen fuer Zeichen gleich herauskommen. Die Zeichensatzdaten
 * von Node und Chromium unterscheiden sich in der Wahl des Apostrophs, und
 * schon das kostet beim ersten Abgleich den gesamten servergerenderten
 * Baum - React verwirft ihn und zeichnet neu.
 */
export function formatAmount(franken: number): string {
  const negative = franken < 0;
  const value = Math.abs(franken);
  const whole = Math.trunc(value);
  const cents = Math.round((value - whole) * 100);

  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const tail = cents === 0 ? '' : `.${String(cents).padStart(2, '0')}`;

  return `${negative ? '-' : ''}${grouped}${tail}`;
}

export function formatCHF(value: Rappen): string {
  return `CHF ${formatAmount(value / 100)}`;
}

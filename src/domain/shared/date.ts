/**
 * Datumsformate der Schweiz. Framework-frei und deterministisch.
 *
 * Kein Intl: dessen Ausgabe haengt von der ICU-Version ab, und die ist im
 * Node-Prozess eine andere als im Browser. Server und Client formatierten
 * dann unterschiedlich, und React verwirft die gesamte Seite mit einem
 * Hydration-Mismatch. Denselben Fehler gab es schon bei den Betraegen
 * (domain/shared/money.ts).
 *
 * Erwartet wird ein ISO-Datum ('2026-09-18') oder ein ISO-Zeitstempel.
 * Beides wird als Kalendertag gelesen, nicht als Zeitpunkt in einer Zone:
 * ein Vertragsbeginn ist ein Datum, keine Uhrzeit.
 */

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
] as const;

function parts(iso: string): { day: string; month: number; year: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const [, year, month, day] = match;
  if (year === undefined || month === undefined || day === undefined) return null;
  const index = Number(month);
  if (index < 1 || index > 12) return null;
  return { day, month: index, year };
}

/** 18.09.2026 */
export function formatDate(iso: string): string {
  const p = parts(iso);
  if (!p) return '';
  return `${p.day}.${String(p.month).padStart(2, '0')}.${p.year}`;
}

/** 18. September 2026 */
export function formatDateLong(iso: string): string {
  const p = parts(iso);
  if (!p) return '';
  return `${p.day}. ${MONTHS[p.month - 1]} ${p.year}`;
}

/**
 * Regel R8 (Architektur 1): Der Logger nimmt keine Freitexte und keine
 * Personendaten entgegen. Das wird durch die Typsignatur erzwungen, nicht
 * durch eine Konvention - Fehlerberichte sind sonst die realistischste
 * Stelle, an der Kundennamen oder Einkommen die Anwendung verlassen.
 */

/** Erlaubte Werte: IDs, Enums, Zahlen, Flags. Keine beliebigen Strings. */
export type LogValue = number | boolean | null | Brand<string>;

declare const brand: unique symbol;
type Brand<T> = T & { readonly [brand]?: never };

/** Markiert einen String ausdruecklich als personendatenfrei. */
export function safeId(value: string): Brand<string> {
  return value as Brand<string>;
}

export type LogFields = Readonly<Record<string, LogValue>>;

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => emit('debug', event, fields),
  info: (event: string, fields?: LogFields) => emit('info', event, fields),
  warn: (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
};

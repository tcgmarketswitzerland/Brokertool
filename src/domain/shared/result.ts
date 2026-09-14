/**
 * Ergebnis-Typ fuer fachliche Pruefungen, die scheitern duerfen, ohne dass
 * es ein Programmfehler ist - etwa der Abschluss einer Beratung mit offenen
 * Pflichtbereichen. Ausnahmen bleiben echten Fehlern vorbehalten.
 */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

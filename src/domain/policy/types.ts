/** Fachliche Typen bestehender Vertraege. Framework-frei. */

export const POLICY_STATUSES = ['ACTIVE', 'CANCELLED', 'EXPIRED', 'REPLACED', 'UNKNOWN'] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export const PREMIUM_FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'YEARLY', 'SINGLE'] as const;
export type PremiumFrequency = (typeof PREMIUM_FREQUENCIES)[number];

export const POLICY_STATUS_LABEL: Record<PolicyStatus, string> = {
  ACTIVE: 'Aktiv',
  CANCELLED: 'Gekündigt',
  EXPIRED: 'Abgelaufen',
  REPLACED: 'Ersetzt',
  UNKNOWN: 'Unbekannt',
};

export const PREMIUM_FREQUENCY_LABEL: Record<PremiumFrequency, string> = {
  MONTHLY: 'monatlich',
  QUARTERLY: 'vierteljährlich',
  SEMIANNUAL: 'halbjährlich',
  YEARLY: 'jährlich',
  SINGLE: 'Einmalprämie',
};

/** Faktor zur Umrechnung auf ein Jahr. */
const PER_YEAR: Record<PremiumFrequency, number> = {
  MONTHLY: 12, QUARTERLY: 4, SEMIANNUAL: 2, YEARLY: 1, SINGLE: 0,
};

/**
 * Jahrespraemie in Rappen.
 *
 * Ohne diese Umrechnung vergleicht der Berater im Offertvergleich
 * Monatspraemien mit Jahrespraemien - der haeufigste Fehler bei
 * Praemienvergleichen ueberhaupt. Eine Einmalpraemie belastet kein Jahr
 * wiederkehrend und zaehlt deshalb null.
 */
export function annualPremiumCents(
  premiumCents: number | null,
  frequency: PremiumFrequency,
): number | null {
  if (premiumCents === null) return null;
  return premiumCents * PER_YEAR[frequency];
}

/**
 * Naechster Kuendigungstermin aus Ablaufdatum und Kuendigungsfrist.
 *
 * Bewusst konservativ: liegt der errechnete Termin bereits in der
 * Vergangenheit, wird nichts geraten. Ein falscher Termin ist schlimmer
 * als keiner - der Kunde verpasst sonst die Frist im Vertrauen darauf.
 */
export function nextCancellationDate(
  endDate: string | null,
  noticePeriodMonths: number | null,
  today = new Date(),
): string | null {
  if (!endDate || noticePeriodMonths === null) return null;

  const end = new Date(`${endDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return null;

  const year = end.getUTCFullYear();
  const month = end.getUTCMonth() - noticePeriodMonths;
  const day = end.getUTCDate();

  // Auf den letzten Tag des Zielmonats begrenzen. setMonth wuerde bei
  // "31. Dezember minus drei Monate" auf den 1. Oktober ueberlaufen statt
  // auf den 30. September - also NACH HINTEN. Bei einer Kuendigungsfrist
  // waere das fatal: der Kunde verpasst den Termin im Vertrauen auf die
  // Anzeige.
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const deadline = new Date(Date.UTC(year, month, Math.min(day, lastDayOfTarget)));

  if (deadline.getTime() < today.getTime()) return null;
  return deadline.toISOString().slice(0, 10);
}

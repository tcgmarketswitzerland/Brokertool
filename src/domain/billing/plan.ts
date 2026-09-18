/** Preismodell. Framework-frei. */

/** Preis je Nutzerin und Monat, in Rappen (Konzeptpunkt 2). */
export const SEAT_PRICE_CENTS = 3_900;

export const PAYMENT_KINDS = ['CARD', 'PAYPAL', 'APPLE_PAY'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  CARD: 'Kreditkarte',
  PAYPAL: 'PayPal',
  APPLE_PAY: 'Apple Pay',
};

export const PAYMENT_STATUSES = ['PENDING', 'ACTIVE', 'EXPIRED', 'FAILED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'Noch nicht autorisiert',
  ACTIVE: 'Aktiv',
  EXPIRED: 'Abgelaufen',
  FAILED: 'Belastung fehlgeschlagen',
};

/**
 * Monatlicher Betrag in Rappen.
 *
 * Gezaehlt werden aktive Mitglieder, nicht Einladungen: eine Einladung,
 * die niemand einloest, kostet nichts. Und nicht die Zahl der Berater,
 * sondern aller Zugaenge - auch das Backoffice arbeitet mit den Daten.
 */
export function monthlyTotalCents(activeSeats: number): number {
  return Math.max(0, activeSeats) * SEAT_PRICE_CENTS;
}

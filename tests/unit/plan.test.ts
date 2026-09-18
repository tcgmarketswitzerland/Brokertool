import { describe, expect, it } from 'vitest';
import { monthlyTotalCents, SEAT_PRICE_CENTS } from '@/domain/billing/plan';
import { formatCHF, rappen } from '@/domain/shared/money';

describe('monthlyTotalCents', () => {
  it('rechnet je Zugang', () => {
    expect(monthlyTotalCents(1)).toBe(SEAT_PRICE_CENTS);
    expect(monthlyTotalCents(7)).toBe(7 * SEAT_PRICE_CENTS);
  });

  it('kostet ohne Zugang nichts', () => {
    expect(monthlyTotalCents(0)).toBe(0);
  });

  // Ein negativer Wert kann nur aus einem Zaehlfehler kommen. Eine
  // Gutschrift daraus zu machen waere die falsche Antwort.
  it('macht aus einem Zaehlfehler keine Gutschrift', () => {
    expect(monthlyTotalCents(-3)).toBe(0);
  });

  it('zeigt den Preis als Schweizer Betrag', () => {
    expect(formatCHF(rappen(SEAT_PRICE_CENTS))).toBe('CHF 39');
    expect(formatCHF(rappen(monthlyTotalCents(30)))).toBe("CHF 1'170");
  });
});

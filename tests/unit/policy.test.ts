import { describe, expect, it } from 'vitest';
import { annualPremiumCents, nextCancellationDate } from '@/domain/policy/types';

describe('Jahresprämie', () => {
  it.each([
    ['MONTHLY', 4_000, 48_000],
    ['QUARTERLY', 12_000, 48_000],
    ['SEMIANNUAL', 24_000, 48_000],
    ['YEARLY', 48_000, 48_000],
  ] as const)('%s %i Rappen ergibt %i', (frequency, premium, expected) => {
    expect(annualPremiumCents(premium, frequency)).toBe(expected);
  });

  it('eine Einmalprämie belastet kein Jahr wiederkehrend', () => {
    expect(annualPremiumCents(500_000, 'SINGLE')).toBe(0);
  });

  it('ohne Prämie gibt es keine Jahresprämie', () => {
    expect(annualPremiumCents(null, 'YEARLY')).toBeNull();
  });
});

describe('Nächster Kündigungstermin', () => {
  const heute = new Date('2026-09-14');

  it('drei Monate vor Ablauf', () => {
    expect(nextCancellationDate('2027-12-31', 3, heute)).toBe('2027-09-30');
  });

  it('läuft nicht in den Folgemonat über', () => {
    // setMonth würde "31. Dezember minus drei Monate" auf den 1. Oktober
    // schieben statt auf den 30. September - also nach hinten. Bei einer
    // Kündigungsfrist verpasst der Kunde den Termin dann im Vertrauen auf
    // die Anzeige.
    expect(nextCancellationDate('2027-03-31', 1, heute)).toBe('2027-02-28');
    expect(nextCancellationDate('2028-03-31', 1, heute)).toBe('2028-02-29');
  });

  it('rechnet über den Jahreswechsel', () => {
    expect(nextCancellationDate('2027-01-31', 3, heute)).toBe('2026-10-31');
  });

  it('ohne Ablaufdatum kein Termin', () => {
    expect(nextCancellationDate(null, 3, heute)).toBeNull();
  });

  it('ohne Kündigungsfrist kein Termin', () => {
    expect(nextCancellationDate('2027-12-31', null, heute)).toBeNull();
  });

  it('rät nichts, wenn der Termin bereits verstrichen ist', () => {
    // Ein falscher Termin ist schlimmer als keiner: der Kunde verpasst die
    // Frist im Vertrauen darauf.
    expect(nextCancellationDate('2026-10-31', 3, heute)).toBeNull();
  });

  it('kommt mit einem unlesbaren Datum zurecht', () => {
    expect(nextCancellationDate('irgendwann', 3, heute)).toBeNull();
  });
});

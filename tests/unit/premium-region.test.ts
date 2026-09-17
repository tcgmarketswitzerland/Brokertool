import { describe, expect, it } from 'vitest';
import {
  isAmbiguous, lookupRegions, normalisePostalCode, regionCode,
  type RegionTable,
} from '@/domain/health/premium-region';
import table from '@/data/premium-regions.json';

// Der Umweg ueber unknown: TypeScript liest aus der JSON-Datei
// (string|number)[][] und kennt die feste Dreierform nicht.
const REAL = table as unknown as RegionTable;

describe('Postleitzahl bereinigen', () => {
  it('nimmt die reine Zahl', () => {
    expect(normalisePostalCode('8004')).toBe('8004');
  });

  it('nimmt sie auch aus einer Adresszeile', () => {
    expect(normalisePostalCode(' 8004 Zürich ')).toBe('8004');
  });

  it('meldet Unsinn als nicht erkannt statt zu raten', () => {
    expect(normalisePostalCode('Zürich')).toBeNull();
    expect(normalisePostalCode('123')).toBeNull();
  });
});

describe('Nachschlagen in den echten BAG-Daten', () => {
  it('findet eine eindeutige Postleitzahl', () => {
    const found = lookupRegions(REAL, '8914');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ canton: 'ZH', region: 3, code: 'PR-REG CH3' });
  });

  it('gibt bei einer kantonsuebergreifenden Postleitzahl alle Gemeinden zurueck', () => {
    // 6340 liegt in Zug (Baar, Neuheim) und in Zuerich (Hausen am Albis).
    // Wer hier die erste Zeile naehme, zeigte eine falsche Praemie, ohne
    // dass es jemandem auffiele.
    const found = lookupRegions(REAL, '6340');
    expect(found.length).toBeGreaterThan(1);
    expect(new Set(found.map((f) => f.canton))).toEqual(new Set(['ZG', 'ZH']));
    expect(isAmbiguous(found)).toBe(true);
  });

  it('kennt einen Kanton mit nur einer Region', () => {
    // Aargau hat nur die Region 0.
    const found = lookupRegions(REAL, '5000');
    expect(found.every((f) => f.region === 0)).toBe(true);
    expect(isAmbiguous(found)).toBe(false);
  });

  it('liefert fuer eine unbekannte Postleitzahl nichts', () => {
    expect(lookupRegions(REAL, '9999')).toEqual([]);
  });

  it('deckt alle 26 Kantone ab', () => {
    const cantons = new Set(
      Object.values(REAL).flatMap((entries) => entries.map((e) => e[0])));
    expect(cantons.size).toBe(26);
  });

  it('kennt nur Regionen zwischen 0 und 3', () => {
    const regions = new Set(
      Object.values(REAL).flatMap((entries) => entries.map((e) => e[1])));
    expect([...regions].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('Regionskennung', () => {
  it('bildet die Kennung der BAG-Daten', () => {
    expect(regionCode(0)).toBe('PR-REG CH0');
    expect(regionCode(3)).toBe('PR-REG CH3');
  });
});

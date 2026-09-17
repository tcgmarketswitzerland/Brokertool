import { describe, expect, it } from 'vitest';
import {
  ageGroupFor, franchisesFor, queryPremiums, ROW_BYTES,
  type PremiumCatalogue,
} from '@/domain/health/premiums';
import catalogue from '@/data/premiums/index.json';
import zh from '@/data/premiums/ZH.json';
import insurers from '@/data/health-insurers.json';

const CAT = catalogue as PremiumCatalogue;
const ZH = Buffer.from((zh as { data: string }).data, 'base64');

describe('Altersklasse', () => {
  it('ordnet ein Kind bis 18 der Kinderklasse zu', () => {
    expect(ageGroupFor('2010-06-01', '2026-01-01')).toBe('AKL-KIN');
  });

  it('wechselt mit 19 in die Jugendklasse', () => {
    expect(ageGroupFor('2007-01-01', '2026-06-01')).toBe('AKL-JUG');
  });

  it('wechselt mit 26 in die Erwachsenenklasse', () => {
    expect(ageGroupFor('2000-01-01', '2026-06-01')).toBe('AKL-ERW');
  });

  it('rechnet auf den Stichtag, nicht auf heute', () => {
    // Eine Praemie fuer 2026 gilt fuer das Alter im Jahr 2026.
    expect(ageGroupFor('2000-12-31', '2026-06-01')).toBe('AKL-JUG');
    expect(ageGroupFor('2000-12-31', '2027-01-01')).toBe('AKL-ERW');
  });

  it('meldet Unsinn als nicht erkannt', () => {
    expect(ageGroupFor('kein Datum', '2026-01-01')).toBeNull();
  });
});

describe('Franchisen je Altersklasse', () => {
  it('bietet Kindern nur die kleinen Stufen', () => {
    expect(franchisesFor('AKL-KIN', CAT.franchises)).toEqual([0, 100, 200, 300, 400, 500, 600]);
  });

  it('bietet Erwachsenen die gesetzlichen Stufen ab 300', () => {
    expect(franchisesFor('AKL-ERW', CAT.franchises)).toEqual([300, 500, 600, 1000, 1500, 2000, 2500]);
  });
});

describe('Verzeichnis', () => {
  it('deckt jede Versicherernummer der Praemiendaten ab', () => {
    const register = insurers as Record<string, { name: string }>;
    const missing = CAT.insurers.filter((n) => !register[String(n)]);
    expect(missing).toEqual([]);
  });

  it('nennt bekannte Kassen beim Namen', () => {
    const register = insurers as Record<string, { name: string }>;
    expect(register['8']?.name).toBe('CSS Kranken-Versicherung AG');
    expect(register['1562']?.name).toBe('Helsana Versicherungen AG');
  });
});

describe('Abfrage in den echten Daten', () => {
  it('liefert fuer Zuerich Region 1 Erwachsene mit Unfall Angebote', () => {
    const found = queryPremiums(ZH, CAT, {
      region: 1, ageGroup: 'AKL-ERW', withAccident: true, franchise: 300,
    });
    expect(found.length).toBeGreaterThan(20);
  });

  it('sortiert nach Preis, guenstigste zuerst', () => {
    const found = queryPremiums(ZH, CAT, {
      region: 1, ageGroup: 'AKL-ERW', withAccident: true, franchise: 2500,
    });
    const prices = found.map((f) => f.premiumCents);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('macht die hohe Franchise guenstiger als die tiefe', () => {
    // Waere es andersherum, stimmte die Zuordnung der Spalten nicht.
    const q = { region: 1, ageGroup: 'AKL-ERW' as const, withAccident: true };
    const low = queryPremiums(ZH, CAT, { ...q, franchise: 300 });
    const high = queryPremiums(ZH, CAT, { ...q, franchise: 2500 });
    expect(Math.min(...high.map((f) => f.premiumCents)))
      .toBeLessThan(Math.min(...low.map((f) => f.premiumCents)));
  });

  it('macht Kinder guenstiger als Erwachsene', () => {
    const child = queryPremiums(ZH, CAT,
      { region: 1, ageGroup: 'AKL-KIN', withAccident: true, franchise: 0 });
    const adult = queryPremiums(ZH, CAT,
      { region: 1, ageGroup: 'AKL-ERW', withAccident: true, franchise: 300 });
    expect(Math.min(...child.map((f) => f.premiumCents)))
      .toBeLessThan(Math.min(...adult.map((f) => f.premiumCents)));
  });

  it('macht den Einschluss des Unfalls nicht guenstiger', () => {
    const q = { region: 1, ageGroup: 'AKL-ERW' as const, franchise: 300 };
    const withAcc = queryPremiums(ZH, CAT, { ...q, withAccident: true });
    const without = queryPremiums(ZH, CAT, { ...q, withAccident: false });
    expect(Math.min(...withAcc.map((f) => f.premiumCents)))
      .toBeGreaterThanOrEqual(Math.min(...without.map((f) => f.premiumCents)));
  });

  it('filtert auf einzelne Modelle', () => {
    const found = queryPremiums(ZH, CAT, {
      region: 1, ageGroup: 'AKL-ERW', withAccident: true, franchise: 300,
      tariffTypes: ['TAR-BASE'],
    });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((f) => f.tariffType === 'TAR-BASE')).toBe(true);
  });

  it('liefert fuer eine Region, die es im Kanton nicht gibt, nichts', () => {
    expect(queryPremiums(ZH, CAT, {
      region: 0, ageGroup: 'AKL-ERW', withAccident: true, franchise: 300,
    })).toEqual([]);
  });

  it('haelt Praemien in einem plausiblen Rahmen', () => {
    // Zwischen 20 und 1000 Franken im Monat. Ausreisser hiessen, dass die
    // Zahl beim Packen verrutscht ist.
    const found = queryPremiums(ZH, CAT, {
      region: 1, ageGroup: 'AKL-ERW', withAccident: true, franchise: 300,
    });
    expect(found.every((f) => f.premiumCents > 2_000 && f.premiumCents < 100_000)).toBe(true);
  });

  it('packt jede Zeile in genau zwoelf Bytes', () => {
    expect(ZH.length % ROW_BYTES).toBe(0);
  });
});

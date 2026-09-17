import { describe, expect, it } from 'vitest';
import { analysePension, benefitValue, targetIncome } from '@/domain/pension/analysis';
import type { Benefit, Household, PensionInput } from '@/domain/pension/types';

/**
 * Die Vorsorgeanalyse rechnet nur mit dem, was der Berater eingetragen
 * hat. Getestet wird deshalb die Arithmetik und die Haushaltslogik - nicht
 * gesetzliche Herleitungen, die es hier bewusst nicht gibt.
 */

const franken = (chf: number) => chf * 100;

function household(over: Partial<Household> = {}): Household {
  return {
    annualIncomeCents: franken(100_000),
    hasPartner: false,
    partnerIncomeCents: null,
    childCount: 0,
    targetPercent: 80,
    ...over,
  };
}

function benefit(over: Partial<Benefit> = {}): Benefit {
  return {
    pillar: 'PILLAR_1', label: 'Rente',
    annualCents: 0, perChildCents: 0, requiresPartner: false,
    ...over,
  };
}

function input(over: Partial<PensionInput> = {}): PensionInput {
  return {
    household: household(),
    benefits: {
      DEATH: [], DISABILITY_ILLNESS: [], DISABILITY_ACCIDENT: [], RETIREMENT: [],
    },
    ...over,
  };
}

describe('Einzelne Leistung', () => {
  it('zaehlt den festen Betrag', () => {
    expect(benefitValue(benefit({ annualCents: franken(24_000) }), household()))
      .toBe(franken(24_000));
  });

  it('multipliziert die Kinderrente mit der Anzahl Kinder', () => {
    // Die Rechnung, die am Tisch im Kopf passieren muesste.
    const value = benefitValue(
      benefit({ annualCents: franken(24_000), perChildCents: franken(4_800) }),
      household({ childCount: 3 }));
    expect(value).toBe(franken(24_000 + 3 * 4_800));
  });

  it('laesst eine Ehegattenrente ohne Partner ganz weg', () => {
    // Nicht die Haelfte, nicht ein Naeherungswert: sie faellt schlicht an.
    expect(benefitValue(
      benefit({ annualCents: franken(30_000), requiresPartner: true }),
      household({ hasPartner: false }))).toBe(0);
  });

  it('zaehlt sie mit Partner voll', () => {
    expect(benefitValue(
      benefit({ annualCents: franken(30_000), requiresPartner: true }),
      household({ hasPartner: true }))).toBe(franken(30_000));
  });

  it('behandelt eine unsinnige Kinderzahl als keine Kinder', () => {
    expect(benefitValue(
      benefit({ perChildCents: franken(4_800) }),
      household({ childCount: -2 }))).toBe(0);
  });
});

describe('Zielbetrag', () => {
  it('ergibt sich aus Einkommen und Wunschprozentsatz', () => {
    expect(targetIncome(household({ targetPercent: 80 }))).toBe(franken(80_000));
  });

  it('bleibt leer, solange kein Prozentsatz festgelegt ist', () => {
    // Eine Vorgabe waere eine Aussage, die niemand getroffen hat.
    expect(targetIncome(household({ targetPercent: null }))).toBeNull();
  });

  it('bleibt leer ohne Einkommen', () => {
    expect(targetIncome(household({ annualIncomeCents: null }))).toBeNull();
  });
});

describe('Auswertung je Fall', () => {
  const analysis = analysePension(input({
    household: household({ hasPartner: true, childCount: 2 }),
    benefits: {
      DEATH: [
        benefit({ pillar: 'PILLAR_1', annualCents: franken(24_000),
                  perChildCents: franken(9_600), requiresPartner: true }),
        benefit({ pillar: 'PILLAR_2', annualCents: franken(20_000),
                  perChildCents: franken(4_000), requiresPartner: true }),
      ],
      DISABILITY_ILLNESS: [
        benefit({ pillar: 'PILLAR_1', annualCents: franken(24_000) }),
        benefit({ pillar: 'PILLAR_2', annualCents: franken(18_000) }),
      ],
      DISABILITY_ACCIDENT: [
        benefit({ pillar: 'PILLAR_1', annualCents: franken(24_000) }),
        benefit({ pillar: 'UVG', annualCents: franken(56_000) }),
      ],
      RETIREMENT: [
        benefit({ pillar: 'PILLAR_1', annualCents: franken(29_400) }),
        benefit({ pillar: 'PILLAR_2', annualCents: franken(32_000) }),
      ],
    },
  }));

  const find = (c: string) => analysis.cases.find((x) => x.pensionCase === c)!;

  it('summiert Renten und Kinderrenten je Fall', () => {
    // 24'000 + 2x9'600 + 20'000 + 2x4'000
    expect(find('DEATH').totalCents).toBe(franken(24_000 + 19_200 + 20_000 + 8_000));
  });

  it('weist die Betraege der richtigen Saeule zu', () => {
    expect(find('DEATH').byPillar).toEqual([
      { pillar: 'PILLAR_1', annualCents: franken(43_200) },
      { pillar: 'PILLAR_2', annualCents: franken(28_000) },
    ]);
  });

  it('haelt UVG von der ersten Saeule getrennt', () => {
    // Der Kern der Analyse: bei Unfall traegt das UVG, bei Krankheit nicht.
    // In einem Topf waere der Unterschied unsichtbar.
    const pillars = find('DISABILITY_ACCIDENT').byPillar.map((p) => p.pillar);
    expect(pillars).toEqual(['UVG', 'PILLAR_1']);
  });

  it('zeigt die Luecke bei Krankheit, die es beim Unfall nicht gibt', () => {
    const illness = find('DISABILITY_ILLNESS');
    const accident = find('DISABILITY_ACCIDENT');
    expect(illness.gapCents).toBeGreaterThan(0);
    expect(accident.gapCents).toBe(0);
  });

  it('rechnet den Deckungsgrad aus', () => {
    // 42'000 von 80'000 sind 52,5 Prozent.
    expect(find('DISABILITY_ILLNESS').coveragePercent).toBe(52.5);
  });

  it('nennt die groesste Luecke', () => {
    expect(analysis.largestGap?.pensionCase).toBe('DISABILITY_ILLNESS');
    expect(analysis.largestGap?.gapCents).toBe(franken(38_000));
  });

  it('meldet keine negative Luecke bei Ueberdeckung', () => {
    expect(find('DISABILITY_ACCIDENT').gapCents).toBe(0);
  });

  it('liefert alle vier Faelle, auch die leeren', () => {
    expect(analysis.cases).toHaveLength(4);
  });
});

describe('Leere Analyse', () => {
  it('meldet sich als leer, solange nichts eingetragen ist', () => {
    expect(analysePension(input()).isEmpty).toBe(true);
  });

  it('nennt ohne Ziel keine Luecke statt einer erfundenen', () => {
    const result = analysePension(input({
      household: household({ targetPercent: null }),
      benefits: {
        DEATH: [benefit({ annualCents: franken(10_000) })],
        DISABILITY_ILLNESS: [], DISABILITY_ACCIDENT: [], RETIREMENT: [],
      },
    }));
    expect(result.cases[0]?.gapCents).toBeNull();
    expect(result.cases[0]?.coveragePercent).toBeNull();
    expect(result.largestGap).toBeNull();
  });
});

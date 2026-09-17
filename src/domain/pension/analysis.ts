import {
  PENSION_CASES, PILLARS,
  type Benefit, type Household, type PensionCase, type PensionInput, type Pillar,
} from './types';

/**
 * Die Rechnung. Rein, ohne Framework, ohne Datenbank - dieselbe Funktion
 * fuettert Bildschirm, Grafik und spaeter das PDF.
 */

export type PillarAmount = { readonly pillar: Pillar; readonly annualCents: number };

export type CaseResult = {
  readonly pensionCase: PensionCase;
  readonly byPillar: readonly PillarAmount[];
  /** Summe aller Leistungen im Jahr, in Rappen. */
  readonly totalCents: number;
  /** Zielbetrag aus Einkommen und Wunschprozentsatz, null ohne Angabe. */
  readonly targetCents: number | null;
  /** Fehlbetrag zum Ziel; nie negativ. Null, solange kein Ziel feststeht. */
  readonly gapCents: number | null;
  /** Deckungsgrad in Prozent, auf eine Stelle gerundet. */
  readonly coveragePercent: number | null;
};

export type PensionResult = {
  readonly cases: readonly CaseResult[];
  readonly targetCents: number | null;
  /** Groesster Fehlbetrag ueber alle Faelle - die Zahl, die zaehlt. */
  readonly largestGap: { readonly pensionCase: PensionCase; readonly gapCents: number } | null;
  /** Ob ueberhaupt etwas eingetragen wurde. */
  readonly isEmpty: boolean;
};

/**
 * Was eine einzelne Leistung im konkreten Haushalt wert ist.
 *
 * Eine Ehegattenrente ohne Partnerin ist null, keine halbe Rente. Und die
 * Waisenrente zaehlt je Kind - das ist die Multiplikation, die am Tisch im
 * Kopf passieren muesste.
 */
export function benefitValue(benefit: Benefit, household: Household): number {
  if (benefit.requiresPartner && !household.hasPartner) return 0;
  const children = Math.max(0, Math.trunc(household.childCount));
  return benefit.annualCents + benefit.perChildCents * children;
}

export function targetIncome(household: Household): number | null {
  if (household.annualIncomeCents === null || household.targetPercent === null) return null;
  return Math.round(household.annualIncomeCents * (household.targetPercent / 100));
}

function sumByPillar(
  benefits: readonly Benefit[], household: Household,
): readonly PillarAmount[] {
  const totals = new Map<Pillar, number>();
  for (const benefit of benefits) {
    const value = benefitValue(benefit, household);
    if (value === 0) continue;
    totals.set(benefit.pillar, (totals.get(benefit.pillar) ?? 0) + value);
  }
  // Feste Reihenfolge statt Einfuegereihenfolge: die Grafik soll bei jedem
  // Fall dieselbe Schichtung zeigen, sonst laesst sie sich nicht vergleichen.
  return PILLARS
    .filter((p) => (totals.get(p) ?? 0) > 0)
    .map((p) => ({ pillar: p, annualCents: totals.get(p) ?? 0 }));
}

export function analysePension(input: PensionInput): PensionResult {
  const target = targetIncome(input.household);

  const cases = PENSION_CASES.map((pensionCase): CaseResult => {
    const byPillar = sumByPillar(input.benefits[pensionCase] ?? [], input.household);
    const totalCents = byPillar.reduce((sum, p) => sum + p.annualCents, 0);

    return {
      pensionCase,
      byPillar,
      totalCents,
      targetCents: target,
      gapCents: target === null ? null : Math.max(0, target - totalCents),
      coveragePercent: target === null || target === 0
        ? null
        : Math.round((totalCents / target) * 1000) / 10,
    };
  });

  const withGap = cases.filter((c): c is CaseResult & { gapCents: number } =>
    c.gapCents !== null && c.gapCents > 0);

  // Bei gleich grossen Luecken gewinnt der frueher genannte Fall: die
  // Reihenfolge ist fachlich sortiert, Tod vor Alter.
  const largest = withGap.reduce<(CaseResult & { gapCents: number }) | null>(
    (best, c) => (best === null || c.gapCents > best.gapCents ? c : best), null);

  return {
    cases,
    targetCents: target,
    largestGap: largest
      ? { pensionCase: largest.pensionCase, gapCents: largest.gapCents }
      : null,
    isEmpty: cases.every((c) => c.totalCents === 0),
  };
}

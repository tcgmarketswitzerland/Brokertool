import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { analysePension } from '@/domain/pension/analysis';
import {
  PENSION_CASES, PENSION_CASE_LABEL,
  type Benefit, type Household, type PensionCase,
} from '@/domain/pension/types';
import type { SummaryPension } from '@/domain/advice/summary';

export type StoredPension = {
  household: Household;
  /** Rohwerte je Zeilenschluessel, wie im Formular eingegeben. */
  values: Record<string, string>;
  benefits: Record<PensionCase, Benefit[]>;
};

function toBenefits(items: unknown): Record<PensionCase, Benefit[]> {
  const source = typeof items === 'object' && items !== null
    ? (items as Record<string, unknown>) : {};

  return Object.fromEntries(PENSION_CASES.map((c) => {
    const list = Array.isArray(source[c]) ? (source[c] as unknown[]) : [];
    return [c, list.map((raw): Benefit => {
      const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      return {
        pillar: (r.pillar as Benefit['pillar']) ?? 'OTHER',
        label: String(r.label ?? ''),
        annualCents: Number(r.annualCents ?? 0) || 0,
        perChildCents: Number(r.perChildCents ?? 0) || 0,
        requiresPartner: Boolean(r.requiresPartner),
      };
    })];
  })) as Record<PensionCase, Benefit[]>;
}

export async function getPensionAnalysis(sessionId: string): Promise<StoredPension | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pension_analyses')
    .select('annual_income_cents, has_partner, partner_income_cents, child_count, target_percent, items')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (!data) return null;

  const items = data.items as Record<string, unknown>;
  const values = (typeof items?.['__values'] === 'object' && items['__values'] !== null
    ? items['__values'] : {}) as Record<string, string>;

  return {
    household: {
      annualIncomeCents: data.annual_income_cents == null ? null : Number(data.annual_income_cents),
      hasPartner: Boolean(data.has_partner),
      partnerIncomeCents: data.partner_income_cents == null
        ? null : Number(data.partner_income_cents),
      childCount: Number(data.child_count ?? 0),
      targetPercent: data.target_percent == null ? null : Number(data.target_percent),
    },
    values,
    benefits: toBenefits(items),
  };
}

/**
 * Die Analyse in der Form, in der sie ins Protokoll gehoert: das Ergebnis,
 * nicht die Eingabefelder. Ist nichts erfasst, steht im Protokoll auch
 * nichts - eine leere Analyse zu drucken waere schlimmer als keine.
 */
export async function getPensionForSummary(sessionId: string): Promise<SummaryPension | null> {
  const stored = await getPensionAnalysis(sessionId);
  if (!stored) return null;

  const result = analysePension({ household: stored.household, benefits: stored.benefits });
  if (result.isEmpty) return null;

  return {
    annualIncomeCents: stored.household.annualIncomeCents,
    targetPercent: stored.household.targetPercent,
    targetCents: result.targetCents,
    hasPartner: stored.household.hasPartner,
    childCount: stored.household.childCount,
    cases: result.cases.map((c) => ({
      pensionCase: c.pensionCase,
      label: PENSION_CASE_LABEL[c.pensionCase],
      totalCents: c.totalCents,
      gapCents: c.gapCents,
      coveragePercent: c.coveragePercent,
    })),
    largestGapLabel: result.largestGap
      ? PENSION_CASE_LABEL[result.largestGap.pensionCase]
      : null,
  };
}

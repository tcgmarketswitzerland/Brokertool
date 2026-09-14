import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PolicyStatus, PremiumFrequency } from '@/domain/policy/types';

export type Policy = {
  id: string;
  topicId: string;
  topicName: string;
  topicIcon: string | null;
  personId: string | null;
  insurerName: string;
  productName: string | null;
  policyNumber: string | null;
  status: PolicyStatus;
  startDate: string | null;
  endDate: string | null;
  premiumCents: number | null;
  premiumFrequency: PremiumFrequency;
  sumInsuredCents: number | null;
  deductibleCents: number | null;
  noticePeriodMonths: number | null;
};

export type Insurer = { id: string; name: string };

function row(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function nameOf(value: unknown): string {
  const record = row(value);
  return String(record['de'] ?? '');
}

export async function listInsurers(): Promise<Insurer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('insurers').select('id, name').eq('is_active', true).order('name');
  return (data ?? []).map((r) => ({ id: String(r.id), name: String(r.name) }));
}

export async function listPolicies(customerId: string): Promise<Policy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('policies')
    .select(`
      id, topic_id, person_id, insurer_name, product_name, policy_number, status,
      start_date, end_date, premium_cents, premium_frequency, sum_insured_cents,
      deductible_cents, notice_period_months,
      insurers ( name ),
      insurance_topics ( name, icon, display_order )
    `)
    .eq('customer_id', customerId)
    .is('deleted_at', null);

  if (error || !data) return [];

  return data
    .map((entry) => {
      const r = row(entry);
      const catalog = row(r.insurance_topics);
      const insurer = row(r.insurers);
      return {
        policy: {
          id: String(r.id),
          topicId: String(r.topic_id),
          topicName: nameOf(catalog.name),
          topicIcon: catalog.icon == null ? null : String(catalog.icon),
          personId: r.person_id == null ? null : String(r.person_id),
          // Katalogname gewinnt; der Freitext ist die Rueckfallebene.
          insurerName: String(insurer.name ?? r.insurer_name ?? ''),
          productName: r.product_name == null ? null : String(r.product_name),
          policyNumber: r.policy_number == null ? null : String(r.policy_number),
          status: r.status as PolicyStatus,
          startDate: r.start_date == null ? null : String(r.start_date),
          endDate: r.end_date == null ? null : String(r.end_date),
          premiumCents: r.premium_cents == null ? null : Number(r.premium_cents),
          premiumFrequency: r.premium_frequency as PremiumFrequency,
          sumInsuredCents: r.sum_insured_cents == null ? null : Number(r.sum_insured_cents),
          deductibleCents: r.deductible_cents == null ? null : Number(r.deductible_cents),
          noticePeriodMonths: r.notice_period_months == null ? null : Number(r.notice_period_months),
        },
        order: Number(catalog.display_order ?? 0),
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((x) => x.policy);
}

export type UpcomingCancellation = {
  id: string;
  customerId: string;
  customerName: string;
  topicName: string;
  insurerName: string;
  date: string;
};

/** Speist die Dashboard-Kachel "bald kuendbar". */
export async function listUpcomingCancellations(withinDays = 90): Promise<UpcomingCancellation[]> {
  const supabase = await createClient();
  const until = new Date(Date.now() + withinDays * 86_400_000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from('policies')
    .select(`
      id, customer_id, insurer_name, next_cancellation_date,
      customers ( display_name ),
      insurers ( name ),
      insurance_topics ( name )
    `)
    .is('deleted_at', null)
    .not('next_cancellation_date', 'is', null)
    .lte('next_cancellation_date', until)
    .order('next_cancellation_date')
    .limit(50);

  return (data ?? []).map((entry) => {
    const r = row(entry);
    return {
      id: String(r.id),
      customerId: String(r.customer_id),
      customerName: String(row(r.customers).display_name ?? ''),
      topicName: nameOf(row(r.insurance_topics).name),
      insurerName: String(row(r.insurers).name ?? r.insurer_name ?? ''),
      date: String(r.next_cancellation_date),
    };
  });
}

export type PolicyOverviewItem = {
  id: string;
  customerId: string;
  customerName: string;
  topicName: string;
  topicIcon: string | null;
  insurerName: string;
  annualCents: number | null;
  nextCancellation: string | null;
};

/** Alle Vertraege der Firma, fuer die Uebersicht ausserhalb eines Kunden. */
export async function listAllPolicies(): Promise<PolicyOverviewItem[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('policies')
    .select(`
      id, customer_id, insurer_name, premium_cents, premium_frequency,
      next_cancellation_date,
      customers ( display_name ),
      insurers ( name ),
      insurance_topics ( name, icon, display_order )
    `)
    .is('deleted_at', null)
    .limit(500);

  const perYear: Record<string, number> = {
    MONTHLY: 12, QUARTERLY: 4, SEMIANNUAL: 2, YEARLY: 1, SINGLE: 0,
  };

  return (data ?? [])
    .map((entry) => {
      const r = row(entry);
      const catalog = row(r.insurance_topics);
      const premium = r.premium_cents == null ? null : Number(r.premium_cents);
      const factor = perYear[String(r.premium_frequency)] ?? 1;

      return {
        id: String(r.id),
        customerId: String(r.customer_id),
        customerName: String(row(r.customers).display_name ?? ''),
        topicName: nameOf(catalog.name),
        topicIcon: catalog.icon == null ? null : String(catalog.icon),
        insurerName: String(row(r.insurers).name ?? r.insurer_name ?? ''),
        annualCents: premium === null ? null : premium * factor,
        nextCancellation: r.next_cancellation_date == null ? null : String(r.next_cancellation_date),
      };
    })
    .sort((a, b) => a.customerName.localeCompare(b.customerName, 'de-CH'));
}

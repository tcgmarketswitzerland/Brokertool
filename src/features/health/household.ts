import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { annualPremiumCents } from '@/domain/policy/types';

/**
 * Was der Praemienvergleich vom Kunden braucht.
 *
 * Postleitzahl, Personen mit Geburtsdatum und - fuer den Vergleich - die
 * bestehende Praemie. Alles schon erfasst; im Gespraech zaehlt jeder
 * Handgriff weniger.
 */
export type HealthHousehold = {
  postalCode: string | null;
  persons: { id: string; name: string; birthDate: string | null }[];
  /** Monatspraemie der bestehenden Krankenkasse, in Rappen. */
  currentHealthPremiumCents: number | null;
};

export async function getCustomerHousehold(customerId: string): Promise<HealthHousehold> {
  const supabase = await createClient();

  const [{ data: persons }, { data: addresses }, { data: policies }] = await Promise.all([
    supabase.from('customer_persons')
      .select('id, first_name, last_name, date_of_birth, person_role')
      .eq('customer_id', customerId),
    supabase.from('customer_addresses')
      .select('postal_code').eq('customer_id', customerId).limit(1),
    supabase.from('policies')
      .select('premium_cents, premium_frequency, insurance_topics!inner(slug)')
      .eq('customer_id', customerId)
      .eq('insurance_topics.slug', 'krankenkasse')
      .limit(1),
  ]);

  const policy = policies?.[0] as
    { premium_cents?: number | null; premium_frequency?: string } | undefined;

  // Der Vergleich zeigt Monatspraemien; eine jaehrlich gezahlte Praemie
  // muss dafuer umgerechnet werden, sonst stuende eine Ersparnis da, die
  // es nicht gibt.
  const yearly = policy
    ? annualPremiumCents(policy.premium_cents ?? null,
        (policy.premium_frequency ?? 'YEARLY') as never)
    : null;

  return {
    postalCode: addresses?.[0]?.postal_code == null
      ? null : String(addresses[0].postal_code),
    persons: (persons ?? []).map((p) => ({
      id: String(p.id),
      name: `${String(p.first_name)} ${String(p.last_name)}`.trim(),
      birthDate: p.date_of_birth == null ? null : String(p.date_of_birth),
    })),
    currentHealthPremiumCents: yearly === null ? null : Math.round(yearly / 12),
  };
}

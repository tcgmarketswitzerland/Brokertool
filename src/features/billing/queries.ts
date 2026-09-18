import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PaymentKind, PaymentStatus } from '@/domain/billing/plan';

export type PaymentMethod = {
  id: string;
  kind: PaymentKind;
  status: PaymentStatus;
  label: string | null;
  provider: string | null;
};

export type BillingOverview = {
  plan: string;
  activeSeats: number;
  paymentMethod: PaymentMethod | null;
};

/**
 * Alles fuer die Kontouebersicht.
 *
 * Das Zahlungsmittel liest nur der Inhaber: die restriktive Policy aus
 * 0027 laesst niemanden sonst durch. Fuer alle anderen ist es schlicht
 * nicht da - kein Fehler, keine Meldung, nur eine leere Antwort.
 */
export async function getBillingOverview(): Promise<BillingOverview> {
  const supabase = await createClient();

  const [organization, seats, method] = await Promise.all([
    supabase.from('organizations').select('plan').limit(1).maybeSingle(),
    supabase.from('organization_members')
      .select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('payment_methods')
      .select('id, kind, status, label, provider')
      .eq('is_default', true)
      .maybeSingle(),
  ]);

  return {
    plan: organization.data ? String(organization.data.plan) : 'trial',
    activeSeats: seats.count ?? 0,
    paymentMethod: method.data
      ? {
          id: String(method.data.id),
          kind: method.data.kind as PaymentKind,
          status: method.data.status as PaymentStatus,
          label: method.data.label == null ? null : String(method.data.label),
          provider: method.data.provider == null ? null : String(method.data.provider),
        }
      : null,
  };
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { nextCancellationDate } from '@/domain/policy/types';
import { policySchema, type PolicyActionState } from './schemas';

function fieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function savePolicy(
  _prev: PolicyActionState, formData: FormData,
): Promise<PolicyActionState> {
  const policyId = String(formData.get('policyId') ?? '');

  const parsed = policySchema.safeParse({
    customerId: formData.get('customerId'),
    topicId: formData.get('topicId'),
    personId: formData.get('personId'),
    insurerId: formData.get('insurerId'),
    insurerName: formData.get('insurerName'),
    productName: formData.get('productName'),
    policyNumber: formData.get('policyNumber'),
    status: formData.get('status') ?? 'ACTIVE',
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    premium: formData.get('premium'),
    premiumFrequency: formData.get('premiumFrequency') ?? 'YEARLY',
    sumInsured: formData.get('sumInsured'),
    deductible: formData.get('deductible'),
    noticePeriodMonths: formData.get('noticePeriodMonths'),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Bitte Eingaben prüfen.', fields: fieldErrors(parsed.error.issues) };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 'error', message: 'Nicht angemeldet.' };

  const row = {
    customer_id: v.customerId,
    topic_id: v.topicId,
    person_id: v.personId ?? null,
    insurer_id: v.insurerId ?? null,
    // Freitext nur, wenn kein Katalogeintrag gewaehlt wurde - sonst stehen
    // zwei Versicherer im selben Datensatz.
    insurer_name: v.insurerId ? null : (v.insurerName ?? null),
    product_name: v.productName ?? null,
    policy_number: v.policyNumber ?? null,
    status: v.status,
    start_date: v.startDate ?? null,
    end_date: v.endDate ?? null,
    premium_cents: v.premium ?? null,
    premium_frequency: v.premiumFrequency,
    sum_insured_cents: v.sumInsured ?? null,
    deductible_cents: v.deductible ?? null,
    notice_period_months: v.noticePeriodMonths ?? null,
    // Aus Ablauf und Frist errechnet, damit das Dashboard ohne Rechnerei
    // filtern kann. Liegt der Termin schon in der Vergangenheit, bleibt das
    // Feld leer statt zu raten.
    next_cancellation_date: nextCancellationDate(
      v.endDate ?? null, v.noticePeriodMonths ?? null),
    updated_by: auth.user.id,
  };

  const { error } = policyId
    ? await supabase.from('policies').update(row).eq('id', policyId)
    : await supabase.from('policies').insert({ ...row, created_by: auth.user.id });

  if (error) {
    logger.info('policy_save_failed', { reason: safeId(error.code ?? 'unknown') });
    return { status: 'error', message: 'Vertrag konnte nicht gespeichert werden.' };
  }

  revalidatePath(`/kunden/${v.customerId}`);
  revalidatePath('/vertraege');
  return { status: 'ok', message: 'Vertrag gespeichert.' };
}

export async function removePolicy(
  _prev: PolicyActionState, formData: FormData,
): Promise<PolicyActionState> {
  const policyId = String(formData.get('policyId') ?? '');
  const customerId = String(formData.get('customerId') ?? '');

  const supabase = await createClient();
  // Weich entfernen: an einem Vertrag haengt die Beratungshistorie, und ein
  // abgeschlossenes Protokoll muss nachvollziehbar bleiben.
  const { error } = await supabase
    .from('policies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', policyId);

  if (error) return { status: 'error', message: 'Vertrag konnte nicht entfernt werden.' };

  revalidatePath(`/kunden/${customerId}`);
  revalidatePath('/vertraege');
  return { status: 'ok', message: 'Vertrag entfernt.' };
}

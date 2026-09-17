'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { createFullCustomer } from '@/features/customers/actions';
import type { CustomerActionState } from '@/features/customers/schemas';

/**
 * Beratung ansetzen.
 *
 * Ein Einstiegspunkt fuer beide Faelle: bestehender Kunde oder neuer.
 * Frueher fuehrte der Weg ueber die Kundenliste, dort "neu", dort speichern,
 * dann zurueck und "Beratung starten" - vier Schritte fuer die haeufigste
 * Handlung ueberhaupt.
 */
async function start(customerId: string): Promise<never> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_advice_session', {
    p_customer_id: customerId,
  });

  if (error || !data) {
    logger.info('advice_session_start_failed', { reason: safeId(error?.code ?? 'unknown') });
    redirect(`/kunden/${customerId}`);
  }

  logger.info('advice_session_started', { session: safeId(String(data)) });
  revalidatePath('/beratungen');
  redirect(`/beratung/${String(data)}`);
}

export async function scheduleForExisting(formData: FormData): Promise<never> {
  const customerId = String(formData.get('customerId') ?? '');
  if (!customerId) redirect('/beratung-ansetzen');
  return start(customerId);
}

export async function scheduleForNew(
  _prev: CustomerActionState, formData: FormData,
): Promise<CustomerActionState> {
  const result = await createFullCustomer(formData);
  if (!result.ok) return result.state;
  return start(result.customerId);
}

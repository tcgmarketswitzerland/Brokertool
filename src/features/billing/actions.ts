'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { PAYMENT_KINDS } from '@/domain/billing/plan';

export type BillingActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string };

const schema = z.object({
  kind: z.enum(PAYMENT_KINDS),
  // Bei PayPal die Adresse des Kontos. Bei Karte und Apple Pay bleibt das
  // Feld leer: dort gibt es hier nichts einzutippen.
  reference: z.string().trim().max(120).optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
}).refine(
  (v) => v.kind !== 'PAYPAL' || (v.reference !== null && z.email().safeParse(v.reference).success),
  { message: 'Bitte die E-Mail-Adresse des PayPal-Kontos angeben.', path: ['reference'] },
);

/**
 * Zahlungsmittel waehlen.
 *
 * Gespeichert wird die Wahl, nicht das Zahlungsmerkmal. Eine Kartennummer
 * nimmt diese Anwendung an keiner Stelle entgegen - das tut der
 * Zahlungsanbieter, und solange keiner verbunden ist, bleibt der Status
 * auf "noch nicht autorisiert".
 */
export async function savePaymentMethod(
  _prev: BillingActionState, formData: FormData,
): Promise<BillingActionState> {
  const parsed = schema.safeParse({
    kind: formData.get('kind'),
    reference: formData.get('reference'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Bitte Eingaben prüfen.',
    };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 'error', message: 'Nicht angemeldet.' };

  // Erst weg, dann neu: der Teilindex laesst nur ein Standardmittel je
  // Firma zu, und ein Update auf eine Zeile, die es vielleicht nicht gibt,
  // waere zwei Faelle statt einem.
  const { error: clearError } = await supabase
    .from('payment_methods').delete().eq('is_default', true);
  if (clearError) {
    return { status: 'error', message: 'Dafür fehlt Ihnen die Berechtigung.' };
  }

  const { error } = await supabase.from('payment_methods').insert({
    kind: parsed.data.kind,
    label: parsed.data.reference,
    created_by: auth.user.id,
  });

  if (error) {
    logger.info('payment_method_save_failed', { reason: safeId(error.code ?? 'unknown') });
    return {
      status: 'error',
      message: error.code === '42501' || error.code === 'PGRST301'
        ? 'Die Abrechnung führt der Inhaber des Kontos.'
        : 'Das Zahlungsmittel konnte nicht gespeichert werden.',
    };
  }

  logger.info('payment_method_saved', { kind: safeId(parsed.data.kind) });
  revalidatePath('/einstellungen/konto');
  return { status: 'ok', message: 'Zahlungsmittel hinterlegt.' };
}

export async function removePaymentMethod(
  _prev: BillingActionState, _formData: FormData,
): Promise<BillingActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from('payment_methods').delete().eq('is_default', true);

  if (error) {
    return { status: 'error', message: 'Das Zahlungsmittel konnte nicht entfernt werden.' };
  }

  revalidatePath('/einstellungen/konto');
  return { status: 'ok', message: 'Zahlungsmittel entfernt.' };
}

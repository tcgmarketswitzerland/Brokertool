'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import type { AuthState } from './schemas';
import { sessionState } from './bootstrap';

/**
 * Was eine Brokerfirma bei der Eroeffnung angeben muss.
 *
 * Adresse, Kontakt und FINMA-Registernummer stehen spaeter auf jedem
 * Beratungsprotokoll. Sie hier zu verlangen statt sie spaeter
 * nachzutragen ist Absicht: ein Protokoll ohne Absender ist im
 * Streitfall wenig wert, und nachgetragen wird erfahrungsgemaess nie.
 */
const schema = z.object({
  organizationName: z.string().trim().min(2, 'Bitte den Firmennamen angeben.').max(200),
  fullName: z.string().trim().min(2, 'Bitte Ihren Namen angeben.').max(200),
  email: z.string().trim().pipe(z.email('Keine gültige E-Mail-Adresse.')),
  phone: z.string().trim().min(6, 'Bitte die Telefonnummer angeben.').max(40),
  street: z.string().trim().min(2, 'Bitte die Strasse angeben.').max(150),
  postalCode: z.string().trim().regex(/^[1-9][0-9]{3}$/, 'Vierstellige Schweizer Postleitzahl.'),
  city: z.string().trim().min(2, 'Bitte den Ort angeben.').max(100),
  finmaNumber: z.string().trim().min(2, 'Bitte die FINMA-Nummer angeben.').max(60),
});

/**
 * Firma anlegen, nachdem die E-Mail bestaetigt wurde.
 *
 * Danach wird die Sitzung erneuert. Das ist kein Beiwerk: das
 * Zugriffstoken wurde vor der Mitgliedschaft ausgestellt und traegt die
 * Mandantenkennung noch nicht. Ohne Erneuerung landet der Nutzer in einer
 * Anwendung, die ihm nichts zeigt - und hielte das fuer einen Fehler.
 */
export async function createOrganization(
  _prev: AuthState, formData: FormData,
): Promise<AuthState> {
  const parsed = schema.safeParse({
    organizationName: formData.get('organizationName'),
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    street: formData.get('street'),
    postalCode: formData.get('postalCode'),
    city: formData.get('city'),
    finmaNumber: formData.get('finmaNumber'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Bitte Eingaben prüfen.',
    };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/anmelden');

  // Zweite Pruefung kurz vor dem Anlegen. Sie kostet eine Abfrage und
  // verhindert den Fall, in dem jemand mit bestehender Firma dieses
  // Formular sieht und sich dabei eine zweite anlegt - Daten in der einen,
  // Anmeldung in der anderen.
  const state = await sessionState();
  if (state.kind === 'stale_token') return refreshSession();
  if (state.kind === 'unknown') return { status: 'error', message: state.message };
  if (state.kind === 'ready') redirect('/dashboard');

  const { error } = await supabase.rpc('create_organization', {
    p_name: parsed.data.organizationName,
    p_display_name: parsed.data.fullName,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_street: parsed.data.street,
    p_postal_code: parsed.data.postalCode,
    p_city: parsed.data.city,
    p_finma_number: parsed.data.finmaNumber,
  });

  if (error) {
    logger.error('organization_create_failed', { reason: safeId(error.code ?? 'unknown') });
    return { status: 'error', message: 'Die Firma konnte nicht angelegt werden.' };
  }

  await supabase.auth.refreshSession();
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

/** Nur das Token erneuern - fuer den Fall, dass die Firma schon besteht. */
export async function refreshSession(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.refreshSession();
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

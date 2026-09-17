'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import type { AuthState } from './schemas';

const schema = z.object({
  organizationName: z.string().trim().min(2, 'Bitte den Firmennamen angeben.').max(200),
  fullName: z.string().trim().min(2, 'Bitte Ihren Namen angeben.').max(200),
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

  const { error } = await supabase.rpc('create_organization', {
    p_name: parsed.data.organizationName,
    p_display_name: parsed.data.fullName,
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

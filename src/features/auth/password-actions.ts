'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { emailSchema, passwordSchema } from './schemas';

export type PasswordState =
  | { status: 'idle' }
  | { status: 'sent' }
  | { status: 'error'; message: string };

/**
 * Die Rueckmeldung ist immer dieselbe, ob die Adresse existiert oder nicht.
 * Andernfalls liesse sich hier durchprobieren, wer Kunde ist.
 */
export async function requestPasswordReset(
  _prev: PasswordState, formData: FormData,
): Promise<PasswordState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) {
    return { status: 'error', message: 'Keine gültige E-Mail-Adresse.' };
  }

  const host = (await headers()).get('host') ?? '';
  const proto = host.startsWith('localhost') ? 'http' : 'https';

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${proto}://${host}/auth/callback?type=recovery`,
  });

  if (error) {
    logger.info('password_reset_request_failed', { reason: safeId(error.code ?? 'unknown') });
  }

  return { status: 'sent' };
}

export async function updatePassword(
  _prev: PasswordState, formData: FormData,
): Promise<PasswordState> {
  const password = passwordSchema.safeParse(formData.get('password'));
  if (!password.success) {
    return { status: 'error', message: password.error.issues[0]?.message ?? 'Passwort prüfen.' };
  }

  if (formData.get('password') !== formData.get('passwordRepeat')) {
    return { status: 'error', message: 'Die beiden Passwörter stimmen nicht überein.' };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    // Der Wiederherstellungslink erzeugt eine Sitzung. Fehlt sie, ist der
    // Link abgelaufen oder bereits benutzt worden.
    return { status: 'error', message: 'Der Link ist abgelaufen. Bitte fordern Sie einen neuen an.' };
  }

  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) {
    logger.info('password_update_failed', { reason: safeId(error.code ?? 'unknown') });
    return { status: 'error', message: 'Passwort konnte nicht gesetzt werden.' };
  }

  logger.info('password_updated', { user: safeId(auth.user.id) });
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

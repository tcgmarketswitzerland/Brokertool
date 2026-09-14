'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { type AuthState, signInSchema, signUpSchema } from './schemas';

/**
 * Fehlermeldungen sind bewusst unspezifisch, wo sie sonst verraten wuerden,
 * ob eine Adresse registriert ist. Das ist kein Komfortverlust, sondern
 * verhindert, dass jemand den Kundenstamm eines Brokers abzaehlt.
 */
const UNSPECIFIC = 'E-Mail-Adresse oder Passwort stimmen nicht.';

function fieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { status: 'error', message: 'Bitte Eingaben prüfen.', fields: fieldErrors(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    logger.info('sign_in_failed', { reason: safeId(error.code ?? 'unknown') });
    return { status: 'error', message: UNSPECIFIC };
  }

  const target = String(formData.get('weiter') ?? '/dashboard');
  // Nur eigene Pfade: ein offener Weiterleitungsparameter waere eine
  // Phishing-Bruecke auf eine fremde Domain.
  const safeTarget = target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard';

  revalidatePath('/', 'layout');
  // typedRoutes kann einen zur Laufzeit gebildeten Pfad nicht pruefen; die
  // Einschraenkung auf eigene Pfade ist eine Zeile darueber passiert.
  redirect(safeTarget as Route);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get('fullName'),
    organizationName: formData.get('organizationName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { status: 'error', message: 'Bitte Eingaben prüfen.', fields: fieldErrors(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) {
    logger.info('sign_up_failed', { reason: safeId(error.code ?? 'unknown') });
    return {
      status: 'error',
      message: error.code === 'user_already_exists'
        ? 'Für diese Adresse besteht bereits ein Konto.'
        : 'Registrierung nicht möglich. Bitte später erneut versuchen.',
    };
  }

  // Ohne Sitzung wartet die Bestaetigungsmail - die Organisation entsteht
  // dann beim ersten Anmelden.
  if (!data.session) {
    redirect(`/registrieren/bestaetigen?email=${encodeURIComponent(parsed.data.email)}`);
  }

  const { error: orgError } = await supabase.rpc('create_organization', {
    p_name: parsed.data.organizationName,
    p_display_name: parsed.data.fullName,
  });

  if (orgError) {
    logger.error('organization_create_failed', { reason: safeId(orgError.code ?? 'unknown') });
    return { status: 'error', message: 'Konto angelegt, aber die Firma konnte nicht erstellt werden.' };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/anmelden');
}

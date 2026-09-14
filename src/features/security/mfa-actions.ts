'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';

/**
 * Zwei-Faktor-Anmeldung mit TOTP. Bei Finanz- und Vorsorgedaten faktisch
 * erwartet (Analyse 2.12) - eine gestohlene Zugangskombination allein soll
 * nicht reichen, um an den Kundenstamm eines Brokers zu kommen.
 */

export type MfaState =
  | { status: 'idle' }
  | { status: 'enrolling'; factorId: string; qrCode: string; secret: string }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string; factorId?: string; qrCode?: string; secret?: string };

export async function startMfaEnrollment(_prev: MfaState): Promise<MfaState> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Brokertool ${new Date().toISOString().slice(0, 10)}`,
  });

  if (error || !data) {
    logger.info('mfa_enroll_failed', { reason: safeId(error?.code ?? 'unknown') });
    return { status: 'error', message: 'Einrichtung nicht möglich. Bitte erneut versuchen.' };
  }

  return {
    status: 'enrolling',
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function confirmMfaEnrollment(prev: MfaState, formData: FormData): Promise<MfaState> {
  const factorId = String(formData.get('factorId') ?? '');
  const code = String(formData.get('code') ?? '').replace(/\s/g, '');

  // Zurueckgeben, was wir zum erneuten Anzeigen des QR-Codes brauchen -
  // sonst verschwindet er bei einem Tippfehler und die Einrichtung beginnt
  // von vorn.
  const keep = prev.status === 'enrolling'
    ? { factorId: prev.factorId, qrCode: prev.qrCode, secret: prev.secret }
    : {};

  if (!/^\d{6}$/.test(code)) {
    return { status: 'error', message: 'Der Code besteht aus sechs Ziffern.', ...keep };
  }

  const supabase = await createClient();
  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });

  if (challengeError || !challenge) {
    return { status: 'error', message: 'Prüfung nicht möglich. Bitte erneut versuchen.', ...keep };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId, challengeId: challenge.id, code,
  });

  if (error) {
    logger.info('mfa_verify_failed', { reason: safeId(error.code ?? 'unknown') });
    return { status: 'error', message: 'Der Code stimmt nicht. Bitte erneut eingeben.', ...keep };
  }

  logger.info('mfa_enabled', {});
  revalidatePath('/einstellungen/sicherheit');
  return { status: 'ok', message: 'Zwei-Faktor-Anmeldung ist aktiv.' };
}

export async function removeMfaFactor(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const factorId = String(formData.get('factorId') ?? '');
  const supabase = await createClient();

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return { status: 'error', message: 'Faktor konnte nicht entfernt werden.' };
  }

  logger.info('mfa_disabled', {});
  revalidatePath('/einstellungen/sicherheit');
  return { status: 'ok', message: 'Zwei-Faktor-Anmeldung entfernt.' };
}

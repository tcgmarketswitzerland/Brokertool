'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import type { ActionState } from './schemas';

export async function acceptInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get('token') ?? '');
  if (!token) return { status: 'error', message: 'Kein Einladungstoken gefunden.' };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 'error', message: 'Bitte zuerst anmelden.' };

  const { error } = await supabase.rpc('accept_invitation', { p_token: token });

  if (error) {
    logger.info('invitation_accept_failed', { reason: safeId(error.code ?? 'unknown') });
    // Die Datenbankfunktion formuliert die fachlichen Faelle bereits
    // verstaendlich: abgelaufen, bereits eingeloest, andere Adresse.
    return { status: 'error', message: error.message.replace(/^.*?:\s*/, '') };
  }

  // Die Organisation steckt erst nach einer Token-Erneuerung im JWT. Ohne
  // refreshSession() landet der Nutzer in einer Anwendung, die ihm nichts
  // anzeigt, weil auth_org_id() noch NULL liefert.
  await supabase.auth.refreshSession();

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

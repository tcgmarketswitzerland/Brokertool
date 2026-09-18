'use server';

import { randomBytes, createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { changeRoleSchema, inviteSchema, memberIdSchema, type ActionState } from './schemas';

/**
 * Der Einladungslink enthaelt ein Zufallstoken; gespeichert wird nur dessen
 * Hash. Wer die Tabelle lesen kann, koennte sonst jede offene Einladung
 * uebernehmen.
 */
function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: createHash('sha256').update(token, 'utf8').digest('hex') };
}

const INVITE_DAYS = 7;

export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    jobTitle: formData.get('jobTitle'),
    finmaNumber: formData.get('finmaNumber'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Eingabe prüfen.' };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 'error', message: 'Nicht angemeldet.' };

  const { token, hash } = newToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();

  // organization_id kommt aus dem Spalten-Default (auth_org_id()), nie aus
  // dem Formular - Regel R5.
  const { error } = await supabase.from('invitations').insert({
    email: parsed.data.email,
    role: parsed.data.role,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    job_title: parsed.data.jobTitle,
    finma_number: parsed.data.finmaNumber,
    token_hash: hash,
    expires_at: expiresAt,
    invited_by: auth.user.id,
  });

  if (error) {
    logger.info('invite_failed', { reason: safeId(error.code ?? 'unknown') });
    return {
      status: 'error',
      message: error.code === '23505'
        ? 'Für diese Adresse ist bereits eine Einladung offen.'
        : 'Einladung konnte nicht erstellt werden.',
    };
  }

  const host = (await headers()).get('host') ?? '';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const inviteUrl = `${proto}://${host}/einladung?token=${token}`;

  logger.info('invite_created', { role: safeId(parsed.data.role) });
  revalidatePath('/einstellungen/benutzer');

  // Im MVP gibt es noch keinen Mailversand (Konzeptpunkt 13). Der Link wird
  // angezeigt und kopiert; das Token steht ausschliesslich hier, nie in der
  // Datenbank und nie im Protokoll.
  return { status: 'ok', message: 'Einladung erstellt.', inviteUrl };
}

export async function revokeInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('invitationId') ?? '');
  const supabase = await createClient();

  const { error } = await supabase
    .from('invitations')
    .update({ status: 'REVOKED' })
    .eq('id', id)
    .eq('status', 'PENDING');

  if (error) return { status: 'error', message: 'Einladung konnte nicht zurückgezogen werden.' };

  revalidatePath('/einstellungen/benutzer');
  return { status: 'ok', message: 'Einladung zurückgezogen.' };
}

export async function changeRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = changeRoleSchema.safeParse({
    memberId: formData.get('memberId'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { status: 'error', message: 'Eingabe prüfen.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('organization_members')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.memberId);

  if (error) {
    // guard_last_owner() verhindert, dass die letzte Inhaberrolle verschwindet.
    const lastOwner = error.message.includes('mindestens einen Owner');
    return {
      status: 'error',
      message: lastOwner
        ? 'Die Firma braucht mindestens einen Inhaber.'
        : 'Rolle konnte nicht geändert werden.',
    };
  }

  revalidatePath('/einstellungen/benutzer');
  return { status: 'ok', message: 'Rolle geändert.' };
}

export async function setMemberActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = memberIdSchema.safeParse({ memberId: formData.get('memberId') });
  if (!parsed.success) return { status: 'error', message: 'Eingabe prüfen.' };
  const active = formData.get('active') === 'true';

  const supabase = await createClient();
  const { error } = await supabase
    .from('organization_members')
    .update({ is_active: active })
    .eq('id', parsed.data.memberId);

  if (error) {
    const lastOwner = error.message.includes('mindestens einen Owner');
    return {
      status: 'error',
      message: lastOwner
        ? 'Die Firma braucht mindestens einen aktiven Inhaber.'
        : 'Änderung nicht möglich.',
    };
  }

  revalidatePath('/einstellungen/benutzer');
  return { status: 'ok', message: active ? 'Zugang aktiviert.' : 'Zugang deaktiviert.' };
}

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OrgRole } from './schemas';

export type Member = {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: OrgRole;
  jobTitle: string | null;
  finmaNumber: string | null;
  isActive: boolean;
};

export type Invitation = {
  id: string;
  email: string;
  role: OrgRole;
  name: string | null;
  /**
   * Serverseitig berechnet. Waehrend des Renderns auf die Uhr zu schauen
   * waere unrein und ergaebe auf Server und Client verschiedene Werte -
   * also einen Hydrationskonflikt.
   */
  daysLeft: number;
};

/**
 * RLS filtert bereits auf die aktive Organisation - ein zusaetzliches
 * where organization_id = ... waere Sicherheitstheater und wuerde nur
 * verdecken, worauf die Absicherung tatsaechlich beruht.
 */
export async function listMembers(): Promise<Member[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, user_id, display_name, email, role, job_title, finma_number, is_active')
    .order('role')
    .order('display_name');

  if (error || !data) return [];

  return data.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    displayName: String(r.display_name),
    email: String(r.email),
    role: r.role as OrgRole,
    jobTitle: r.job_title == null ? null : String(r.job_title),
    finmaNumber: r.finma_number == null ? null : String(r.finma_number),
    isActive: Boolean(r.is_active),
  }));
}

export async function listPendingInvitations(): Promise<Invitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, first_name, last_name, expires_at')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const now = Date.now();
  return data.map((r) => ({
    id: String(r.id),
    email: String(r.email),
    role: r.role as OrgRole,
    name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
    daysLeft: Math.max(0, Math.ceil((new Date(String(r.expires_at)).getTime() - now) / 86_400_000)),
  }));
}

export async function currentMember(): Promise<Member | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from('organization_members')
    .select('id, user_id, display_name, email, role, job_title, finma_number, is_active')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    id: String(data.id),
    userId: String(data.user_id),
    displayName: String(data.display_name),
    email: String(data.email),
    role: data.role as OrgRole,
    jobTitle: data.job_title == null ? null : String(data.job_title),
    finmaNumber: data.finma_number == null ? null : String(data.finma_number),
    isActive: Boolean(data.is_active),
  };
}

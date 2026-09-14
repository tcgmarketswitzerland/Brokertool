import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OrgRole } from './schemas';

export type Member = {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: OrgRole;
  isActive: boolean;
};

export type Invitation = {
  id: string;
  email: string;
  role: OrgRole;
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
    .select('id, user_id, display_name, email, role, is_active')
    .order('role')
    .order('display_name');

  if (error || !data) return [];

  return data.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    displayName: String(r.display_name),
    email: String(r.email),
    role: r.role as OrgRole,
    isActive: Boolean(r.is_active),
  }));
}

export async function listPendingInvitations(): Promise<Invitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, expires_at')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const now = Date.now();
  return data.map((r) => ({
    id: String(r.id),
    email: String(r.email),
    role: r.role as OrgRole,
    daysLeft: Math.max(0, Math.ceil((new Date(String(r.expires_at)).getTime() - now) / 86_400_000)),
  }));
}

export async function currentMember(): Promise<Member | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from('organization_members')
    .select('id, user_id, display_name, email, role, is_active')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    id: String(data.id),
    userId: String(data.user_id),
    displayName: String(data.display_name),
    email: String(data.email),
    role: data.role as OrgRole,
    isActive: Boolean(data.is_active),
  };
}

import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type MfaFactor = {
  id: string;
  friendlyName: string;
  createdAt: string;
};

export async function listMfaFactors(): Promise<MfaFactor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return [];

  return data.totp.map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? 'Authenticator',
    createdAt: f.created_at,
  }));
}

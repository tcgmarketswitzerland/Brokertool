import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger, safeId } from '@/lib/logger';
import type { Database } from '@/types/database';

export type SignatureInput = {
  organizationId: string;
  sessionId: string;
  snapshotId: string;
  signerName: string;
  dataUrl: string;
};

/**
 * Unterschrift ablegen.
 *
 * Der Pfad beginnt mit der Mandantenkennung, weil die Storage-Policy
 * genau daran die Zugehoerigkeit prueft (Migration 0021). Wer den Pfad
 * anders baut, bekommt keine Fehlermeldung mit Erklaerung, sondern einen
 * abgelehnten Upload - deshalb entsteht er hier an einer Stelle.
 */
export async function storeSignature(
  supabase: SupabaseClient<Database>, input: SignatureInput,
): Promise<boolean> {
  const base64 = input.dataUrl.slice(input.dataUrl.indexOf(',') + 1);
  const bytes = Buffer.from(base64, 'base64');
  const path = `${input.organizationId}/${input.sessionId}/kunde.png`;

  const { error: uploadError } = await supabase.storage
    .from('signatures')
    .upload(path, bytes, { contentType: 'image/png', upsert: false });

  if (uploadError) {
    logger.info('signature_upload_failed', { session: safeId(input.sessionId) });
    return false;
  }

  const { error } = await supabase.from('signatures').insert({
    session_id: input.sessionId,
    snapshot_id: input.snapshotId,
    kind: 'CUSTOMER',
    signer_name: input.signerName,
    storage_path: path,
  });

  if (error) {
    logger.info('signature_insert_failed', { session: safeId(input.sessionId) });
    return false;
  }

  return true;
}

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger, safeId } from '@/lib/logger';
import type { Database } from '@/types/database';

export type SignatureInput = {
  sessionId: string;
  snapshotId: string;
  signerName: string;
  /** PNG als Data-URL aus dem Unterschriftenfeld. */
  dataUrl: string;
};

/**
 * Unterschrift ablegen.
 *
 * In der eigenen Tabelle, nicht im Objektspeicher (Begruendung in
 * Migration 0020). Damit gelten dieselben Mandantenregeln wie fuer alles
 * andere - erzeugt, geprueft und selbst kontrolliert von
 * assert_rls_complete().
 */
export async function storeSignature(
  supabase: SupabaseClient<Database>, input: SignatureInput,
): Promise<boolean> {
  const base64 = input.dataUrl.slice(input.dataUrl.indexOf(',') + 1);

  const { error } = await supabase.from('signatures').insert({
    session_id: input.sessionId,
    snapshot_id: input.snapshotId,
    kind: 'CUSTOMER',
    signer_name: input.signerName,
    image_base64: base64,
    content_type: 'image/png',
  });

  if (error) {
    logger.info('signature_insert_failed', {
      session: safeId(input.sessionId), reason: safeId(error.code ?? 'unknown'),
    });
    return false;
  }

  return true;
}

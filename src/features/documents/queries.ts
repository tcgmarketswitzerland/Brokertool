import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type CustomerDocument = {
  id: string;
  topicId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

/**
 * Alle Dokumente eines Kunden, neueste zuerst.
 *
 * Bewusst ohne Filter auf die Beratung: eine Police, die im letzten
 * Gespraech hochgeladen wurde, soll im naechsten wieder da sein.
 */
export async function listCustomerDocuments(customerId: string): Promise<CustomerDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documents')
    .select('id, topic_id, original_filename, mime_type, size_bytes, created_at')
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return data.map((r) => ({
    id: String(r.id),
    topicId: r.topic_id == null ? null : String(r.topic_id),
    filename: String(r.original_filename),
    mimeType: String(r.mime_type),
    sizeBytes: Number(r.size_bytes),
    createdAt: String(r.created_at),
  }));
}

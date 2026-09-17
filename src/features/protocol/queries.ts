import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { SummaryDocument } from '@/domain/advice/summary';

export type Snapshot = {
  id: string;
  sessionId: string;
  document: SummaryDocument;
  contentHash: string;
  createdAt: string;
};

/**
 * Der eingefrorene Stand einer abgeschlossenen Beratung.
 *
 * Bewusst ohne Pruefung des Schemas: das Dokument wurde beim Abschluss aus
 * demselben Typ erzeugt und ist seither unveraenderlich. Eine Validierung
 * hier wuerde ein aelteres schemaVersion ablehnen und damit genau die
 * Dokumente unlesbar machen, deren Aufbewahrung der Zweck der Sache ist.
 */
export async function getSnapshot(sessionId: string): Promise<Snapshot | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('advice_session_snapshots')
    .select('id, session_id, document, content_hash, created_at')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: String(data.id),
    sessionId: String(data.session_id),
    document: data.document as SummaryDocument,
    contentHash: String(data.content_hash),
    createdAt: String(data.created_at),
  };
}

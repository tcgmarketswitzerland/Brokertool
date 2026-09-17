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

export type SignatureRecord = {
  signerName: string;
  signedAt: string;
  /** Das Bild als Data-URL, damit der PDF-Renderer es ohne Netzzugriff einbettet. */
  dataUrl: string | null;
};

/**
 * Die Unterschrift zu einer Beratung.
 *
 * Das Bild wird hier heruntergeladen statt als signierte URL
 * weitergereicht: der PDF-Renderer laeuft auf dem Server, und eine URL,
 * die er selbst abruft, waere ein zweiter Weg an den Policies vorbei.
 */
export async function getSignature(sessionId: string): Promise<SignatureRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('signatures')
    .select('signer_name, signed_at, storage_path')
    .eq('session_id', sessionId)
    .eq('kind', 'CUSTOMER')
    .maybeSingle();

  if (!data) return null;

  const { data: file } = await supabase.storage
    .from('signatures').download(String(data.storage_path));

  const dataUrl = file
    ? `data:image/png;base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`
    : null;

  return {
    signerName: String(data.signer_name),
    signedAt: String(data.signed_at),
    dataUrl,
  };
}

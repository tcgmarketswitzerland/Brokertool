import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { signedDocumentUrl } from '@/lib/storage/documents';

/**
 * Ein Dokument ansehen oder entfernen.
 *
 * Die Datei liegt in einem privaten Bucket. Ob sie herausgegeben wird,
 * entscheidet die Datenbank: findet die Abfrage die Zeile nicht, gehoert
 * das Dokument einer anderen Firma - und die Antwort ist dieselbe wie bei
 * einer erfundenen ID.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const { data: document } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!document) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

  const url = await signedDocumentUrl(String(document.storage_path), auth.user.id);
  if (!url) return NextResponse.json({ error: 'Nicht verfügbar' }, { status: 502 });

  // Weiterleitung statt Durchreichen: die Datei nimmt so nicht den Umweg
  // ueber den Anwendungsserver, und die signierte URL laeuft in einer
  // Minute ab.
  return NextResponse.redirect(url, { status: 307 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });

  // Weich entfernen: die Datei bleibt liegen, weil ein abgeschlossenes
  // Protokoll darauf verweisen kann. Endgueltig geloescht wird erst mit
  // dem Kunden, nach Ablauf der Aufbewahrungsfrist.
  const { error, count } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', documentId)
    .is('deleted_at', null);

  if (error) {
    return NextResponse.json({ error: 'Konnte nicht entfernt werden.' }, { status: 409 });
  }
  if (count === 0) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}

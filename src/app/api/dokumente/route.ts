import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { EXTENSION, sniffType } from '@/domain/document/sniff';
import { documentPath, MAX_BYTES, putDocument, removeDocument } from '@/lib/storage/documents';

/**
 * Dokumente hochladen.
 *
 * Route Handler und nicht Server Action, weil hier eine Datei uebertragen
 * wird und der Client den Fortschritt sowie klare Statuscodes braucht.
 *
 * Die Reihenfolge ist Absicht: erst prueft die Datenbank ueber RLS, ob der
 * Kunde ueberhaupt sichtbar ist, dann wird die Datei geprueft, dann
 * abgelegt, und erst zuletzt entsteht der Datenbankeintrag. Faellt der
 * Eintrag aus, wird die Datei wieder entfernt - eine Datei ohne Eintrag
 * waere spaeter weder auffindbar noch loeschbar.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function field(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }

  const file = form.get('file');
  const customerId = field(form, 'customerId');
  const sessionId = field(form, 'sessionId');
  const topicId = field(form, 'topicId');

  if (!(file instanceof File) || !customerId || !UUID.test(customerId)) {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }
  if ((sessionId && !UUID.test(sessionId)) || (topicId && !UUID.test(topicId))) {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Die Datei ist leer oder grösser als 20 MB.' }, { status: 413 },
    );
  }

  // RLS entscheidet, ob der Kunde zur eigenen Firma gehoert. Die
  // organization_id kommt aus derselben Zeile und nicht aus der Anfrage.
  const { data: customer } = await supabase
    .from('customers')
    .select('id, organization_id')
    .eq('id', customerId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!customer) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 });

  const buffer = await file.arrayBuffer();
  const sniffed = sniffType(new Uint8Array(buffer.slice(0, 16)));
  if (sniffed === null) {
    return NextResponse.json(
      { error: 'Nur PDF, JPEG und PNG werden angenommen.' }, { status: 415 },
    );
  }

  const id = crypto.randomUUID();
  const path = documentPath(
    String(customer.organization_id), customerId, id, EXTENSION[sniffed],
  );

  if (!await putDocument(path, buffer, sniffed, auth.user.id)) {
    return NextResponse.json({ error: 'Die Datei konnte nicht abgelegt werden.' }, { status: 502 });
  }

  const { error } = await supabase.from('documents').insert({
    id,
    customer_id: customerId,
    session_id: sessionId,
    topic_id: topicId,
    // Der Originalname wird nur angezeigt, nie als Pfad verwendet.
    original_filename: file.name.slice(0, 200) || `dokument.${EXTENSION[sniffed]}`,
    kind: sniffed === 'application/pdf' ? 'POLICY' : 'OTHER',
    storage_path: path,
    mime_type: sniffed,
    size_bytes: file.size,
    uploaded_by: auth.user.id,
  });

  if (error) {
    // Ohne Eintrag waere die Datei spaeter weder auffindbar noch loeschbar.
    await removeDocument(path, auth.user.id);
    logger.info('document_insert_failed', { reason: safeId(error.code ?? 'unknown') });
    return NextResponse.json({ error: 'Das Dokument konnte nicht erfasst werden.' }, { status: 500 });
  }

  return NextResponse.json({
    id,
    filename: file.name,
    mimeType: sniffed,
    sizeBytes: file.size,
  }, { status: 201 });
}

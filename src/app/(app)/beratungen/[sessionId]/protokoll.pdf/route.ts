import { renderToBuffer } from '@react-pdf/renderer';
import { ProtocolDocument } from '@/features/protocol/pdf-document';
import { getSignature, getSnapshot } from '@/features/protocol/queries';
import { getOrganization } from '@/features/organization/queries';

export const dynamic = 'force-dynamic';
// @react-pdf/renderer braucht Node-APIs; im Edge-Runtime faellt es aus.
export const runtime = 'nodejs';

/**
 * Das Protokoll als PDF.
 *
 * Erzeugt aus dem Snapshot, nicht aus dem aktuellen Stand: ein Nachdruck
 * muss dasselbe zeigen wie der Ausdruck vom Gespraechstag. Die Zeilen sind
 * durch Row Level Security geschuetzt - wer den Snapshot nicht lesen darf,
 * bekommt hier 404 und nicht etwa ein leeres Dokument.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const snapshot = await getSnapshot(sessionId);
  if (!snapshot) return new Response('Nicht gefunden', { status: 404 });

  const [signature, organization] = await Promise.all([
    getSignature(sessionId), getOrganization(),
  ]);

  const buffer = await renderToBuffer(
    ProtocolDocument({
      document: snapshot.document,
      contentHash: snapshot.contentHash,
      ...(signature ? { signature } : {}),
      // Logo und Hausfarbe kommen aus dem heutigen Stand: sie sind
      // Darstellung, nicht Inhalt. Der Inhalt liegt im Snapshot.
      branding: {
        logoDataUrl: organization?.logoDataUrl ?? null,
        brandColor: organization?.brandColor ?? null,
      },
    }),
  );

  const name = snapshot.document.customerName.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 60);

  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition':
        `inline; filename="Beratungsprotokoll-${name}-${snapshot.document.date}.pdf"`,
      // Ein Protokoll gehoert nicht in einen Zwischenspeicher, auf den ein
      // anderer Mandant zugreifen koennte.
      'cache-control': 'private, no-store',
    },
  });
}

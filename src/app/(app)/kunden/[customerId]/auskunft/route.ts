import { exportCustomer } from '@/features/privacy/export';
import { logger, safeId } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Auskunft ueber alle Daten eines Kunden, als Datei.
 *
 * Dass eine Auskunft erteilt wurde, gehoert ins Protokoll - nicht wegen
 * der Technik, sondern weil die betroffene Person spaeter fragen kann,
 * wann sie Auskunft erhalten hat.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params;
  const data = await exportCustomer(customerId);
  if (!data) return new Response('Nicht gefunden', { status: 404 });

  logger.info('customer_export_created', { customer: safeId(customerId) });

  const name = String((data.kunde as { display_name?: string }).display_name ?? 'Kunde')
    .replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 60);

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition':
        `attachment; filename="Auskunft-${name}-${new Date().toISOString().slice(0, 10)}.json"`,
      'cache-control': 'private, no-store',
    },
  });
}

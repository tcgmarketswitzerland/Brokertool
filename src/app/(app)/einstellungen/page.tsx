import type { Metadata } from 'next';
import { ComingSoon } from '@/components/layout/coming-soon';

export const metadata: Metadata = { title: 'Einstellungen' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <ComingSoon
      title="Einstellungen"
      phase="Phase 8"
      description="Firma, Benutzer und Rollen, Zwei-Faktor-Pflicht, Logo für das Beratungsprotokoll sowie die Auswahl der Versicherungssparten."
    />
  );
}

import type { Metadata } from 'next';
import { ComingSoon } from '@/components/layout/coming-soon';

export const metadata: Metadata = { title: 'Kunden' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <ComingSoon
      title="Kunden"
      phase="Phase 2"
      description="Kunden anlegen, suchen und bearbeiten — Schnellanlage in unter 30 Sekunden, dazu CSV-Import aus dem bestehenden Maklersystem."
    />
  );
}

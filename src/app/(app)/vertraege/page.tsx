import type { Metadata } from 'next';
import { ComingSoon } from '@/components/layout/coming-soon';

export const metadata: Metadata = { title: 'Verträge' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <ComingSoon
      title="Verträge"
      phase="Phase 4"
      description="Bestehende Policen über alle Kunden hinweg, mit Ablauf- und Kündigungsfristen für die Übersicht."
    />
  );
}

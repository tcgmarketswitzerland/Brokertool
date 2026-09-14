import type { Metadata } from 'next';
import { ComingSoon } from '@/components/layout/coming-soon';

export const metadata: Metadata = { title: 'Aufgaben' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <ComingSoon
      title="Aufgaben"
      phase="Phase 5"
      description="Aufgaben für Kunde und Berater, direkt aus dem Gespräch heraus erfasst und mit der besprochenen Sparte verknüpft."
    />
  );
}

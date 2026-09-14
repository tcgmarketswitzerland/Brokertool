import type { Metadata } from 'next';
import { ComingSoon } from '@/components/layout/coming-soon';

export const metadata: Metadata = { title: 'Beratungen' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <ComingSoon
      title="Beratungen"
      phase="Phase 3"
      description="Laufende und abgeschlossene Beratungen. Das Beratungsrad, das Statusmodell und die Synchronisation entstehen hier."
    />
  );
}

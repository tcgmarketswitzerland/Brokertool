import type { Metadata } from 'next';
import { PensionAnalysis } from '@/features/pension/pension-analysis';

export const metadata: Metadata = { title: 'Vorsorgeanalyse — Vorschau' };

export default function PensionPreviewPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-5 py-8">
      <div className="grid gap-1">
        <h1 className="text-2xl">Vorsorgeanalyse</h1>
        <p className="text-sm text-ink-muted">
          Vorschau ohne Anmeldung. Alle Felder sind leer — tragen Sie Beträge ein, die
          Grafik entsteht dabei.
        </p>
      </div>
      <PensionAnalysis />
    </div>
  );
}

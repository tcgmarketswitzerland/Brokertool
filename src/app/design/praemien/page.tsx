import type { Metadata } from 'next';
import { PremiumComparison } from '@/features/health/premium-comparison';

export const metadata: Metadata = { title: 'Prämienvergleich — Vorschau' };

export default function PremiumPreviewPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-5 py-8">
      <div className="grid gap-1">
        <h1 className="text-2xl">Prämienvergleich</h1>
        <p className="text-sm text-ink-muted">
          Vorschau ohne Anmeldung. Echte Prämien des Bundesamts für Gesundheit.
          Probieren Sie 8004 (eindeutig) und 6340 (liegt in zwei Kantonen).
        </p>
      </div>
      <PremiumComparison
        persons={[
          { id: '1', name: 'Max Muster', birthDate: '1985-04-12' },
          { id: '2', name: 'Anna Muster', birthDate: '1987-09-03' },
          { id: '3', name: 'Lea Muster', birthDate: '2015-02-20' },
        ]}
        currentPremiumCents={48_500}
      />
    </div>
  );
}

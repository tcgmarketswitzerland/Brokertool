import type { Metadata } from 'next';
import { CalendarClock, CheckSquare, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';

export const metadata: Metadata = { title: 'Übersicht' };
export const dynamic = 'force-dynamic';

/**
 * Platzhalter. Die Kennzahlen entstehen in Phase 8, weil sie Daten
 * aggregieren, die es vor Phase 5 noch gar nicht gibt (Projektplan).
 */
const TILES = [
  { label: 'Offene Beratungen', value: '—', Icon: FileText },
  { label: 'Offene Aufgaben', value: '—', Icon: CheckSquare },
  { label: 'Bald kündbare Policen', value: '—', Icon: CalendarClock },
] as const;

export default function DashboardPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl">Übersicht</h1>
        <p className="text-sm text-ink-muted">Ihr Tag auf einen Blick.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {TILES.map(({ label, value, Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <p className="text-[0.8125rem] text-ink-muted">{label}</p>
                <p className="tabular text-2xl font-semibold">{value}</p>
              </div>
              <Icon aria-hidden className="size-4 text-ink-subtle" strokeWidth={2} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-1.5 py-10 text-center">
          <p className="font-medium">Noch keine Kunden erfasst</p>
          <p className="mx-auto max-w-sm text-[0.8125rem] leading-relaxed text-ink-muted">
            Die Kundenverwaltung entsteht in Phase 2. Danach starten Sie von hier aus
            direkt eine Beratung.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

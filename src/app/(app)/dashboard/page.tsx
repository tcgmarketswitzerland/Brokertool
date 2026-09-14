import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, CheckSquare, FileText, Plus, Users } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';
import { countCustomers } from '@/features/customers/queries';

export const metadata: Metadata = { title: 'Übersicht' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const customers = await countCustomers();

  // Die übrigen Kennzahlen entstehen in Phase 8: sie aggregieren Daten, die
  // es vor Phase 5 noch gar nicht gibt. Ein erfundener Wert wäre schlimmer
  // als ein ehrlicher Strich.
  const tiles = [
    { label: 'Kunden', value: String(customers), Icon: Users },
    { label: 'Offene Beratungen', value: '—', Icon: FileText },
    { label: 'Offene Aufgaben', value: '—', Icon: CheckSquare },
    { label: 'Bald kündbare Policen', value: '—', Icon: CalendarClock },
  ] as const;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl">Übersicht</h1>
          <p className="text-sm text-ink-muted">Ihr Tag auf einen Blick.</p>
        </div>
        <Button asChild>
          <Link href="/kunden/neu"><Plus aria-hidden />Neuer Kunde</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, Icon }) => (
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

      {customers === 0 ? (
        <Card>
          <CardContent className="grid gap-2 py-10 text-center">
            <p className="font-medium">Noch keine Kunden erfasst</p>
            <p className="mx-auto max-w-sm text-[0.8125rem] leading-relaxed text-ink-muted">
              Legen Sie den ersten Kunden an — Vor- und Nachname genügen. Oder übernehmen Sie
              Ihre bestehende Liste als CSV.
            </p>
            <div className="mt-2 flex justify-center gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/kunden/import">Liste importieren</Link>
              </Button>
              <Button asChild size="sm"><Link href="/kunden/neu">Kunde anlegen</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

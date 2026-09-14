import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ChevronRight, Plus, Upload, Users } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@/components/ui';
import { CUSTOMER_TYPE_LABEL } from '@/domain/customer/types';
import { CustomerSearch } from '@/features/customers/customer-search';
import { listCustomers } from '@/features/customers/queries';

export const metadata: Metadata = { title: 'Kunden' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const customers = await listCustomers(q);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl">Kunden</h1>
          <p className="text-sm text-ink-muted">
            {customers.length === 0 && !q
              ? 'Noch keine Kunden erfasst.'
              : `${customers.length} ${customers.length === 1 ? 'Kunde' : 'Kunden'}${q ? ' gefunden' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href="/kunden/import"><Upload aria-hidden />Importieren</Link>
          </Button>
          <Button asChild>
            <Link href="/kunden/neu"><Plus aria-hidden />Neuer Kunde</Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={null}><CustomerSearch /></Suspense>

      {customers.length === 0 ? (
        <Card>
          <CardContent className="grid gap-2 py-12 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
              <Users aria-hidden className="size-5" strokeWidth={1.75} />
            </span>
            <p className="font-medium">{q ? 'Nichts gefunden' : 'Noch keine Kunden'}</p>
            <p className="mx-auto max-w-sm text-[0.8125rem] leading-relaxed text-ink-muted">
              {q
                ? 'Versuchen Sie einen anderen Namen.'
                : 'Legen Sie den ersten Kunden an — Vor- und Nachname genügen. Oder übernehmen Sie Ihre bestehende Liste als CSV.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {customers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/kunden/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-hover"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.displayName}</p>
                    <p className="text-[0.8125rem] text-ink-muted">
                      {CUSTOMER_TYPE_LABEL[c.customerType]}
                      {c.personCount > 1 ? ` · ${c.personCount} Personen` : ''}
                    </p>
                  </div>
                  {c.customerType !== 'PRIVATE' ? (
                    <Badge>{CUSTOMER_TYPE_LABEL[c.customerType]}</Badge>
                  ) : null}
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

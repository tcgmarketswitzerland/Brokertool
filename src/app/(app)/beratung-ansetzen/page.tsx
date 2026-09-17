import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { listCustomers } from '@/features/customers/queries';
import { ScheduleView } from './schedule-view';

export const metadata: Metadata = { title: 'Beratung ansetzen' };
export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const customers = await listCustomers();

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="grid gap-2">
        <Link href="/dashboard"
              className="flex w-fit items-center gap-1.5 rounded-sm text-[0.8125rem] text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-3.5" />Übersicht
        </Link>
        <h1 className="text-2xl">Beratung ansetzen</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Kunde wählen oder neu erfassen. Danach öffnet sich das Beratungsrad.
        </p>
      </div>

      <Card>
        <CardContent><ScheduleView customers={customers} /></CardContent>
      </Card>
    </div>
  );
}

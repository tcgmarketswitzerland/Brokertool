import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { QuickCreateForm } from '@/features/customers/quick-create-form';

export const metadata: Metadata = { title: 'Neuer Kunde' };
export const dynamic = 'force-dynamic';

export default function NewCustomerPage() {
  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="grid gap-2">
        <Link href="/kunden"
              className="flex w-fit items-center gap-1.5 rounded-sm text-[0.8125rem] text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-3.5" />Kunden
        </Link>
        <h1 className="text-2xl">Neuer Kunde</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Name genügt. Adresse, Beruf und Einkommen erfassen Sie später dort, wo sie im
          Gespräch gebraucht werden.
        </p>
      </div>

      <Card>
        <CardContent><QuickCreateForm /></CardContent>
      </Card>
    </div>
  );
}

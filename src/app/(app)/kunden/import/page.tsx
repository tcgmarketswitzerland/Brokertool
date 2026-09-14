import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ImportWizard } from '@/features/customers/import-wizard';

export const metadata: Metadata = { title: 'Kunden importieren' };
export const dynamic = 'force-dynamic';

export default function ImportPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <Link href="/kunden"
              className="flex w-fit items-center gap-1.5 rounded-sm text-[0.8125rem] text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-3.5" />Kunden
        </Link>
        <h1 className="text-2xl">Kunden importieren</h1>
        <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
          Übernehmen Sie Ihre bestehende Kundenliste, statt sie ein zweites Mal zu erfassen.
          Sie sehen vor dem Import, was ankommt und was übersprungen wird.
        </p>
      </div>

      <ImportWizard />
    </div>
  );
}

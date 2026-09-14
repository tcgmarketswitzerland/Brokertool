import type { Metadata } from 'next';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui';

export const metadata: Metadata = { title: 'E-Mail bestätigen' };
export const dynamic = 'force-dynamic';

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="grid gap-5 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <MailCheck aria-hidden className="size-5" strokeWidth={2} />
      </div>
      <div className="grid gap-1.5">
        <h1 className="text-2xl">E-Mail bestätigen</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Wir haben einen Bestätigungslink
          {email ? <> an <span className="font-medium text-ink">{email}</span></> : null} geschickt.
          Nach der Bestätigung richten wir Ihre Firma ein.
        </p>
      </div>
      <Button asChild variant="secondary" className="mx-auto">
        <Link href="/anmelden">Zur Anmeldung</Link>
      </Button>
    </div>
  );
}

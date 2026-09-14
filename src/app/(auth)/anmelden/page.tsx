import type { Metadata } from 'next';
import Link from 'next/link';
import { SignInForm } from '@/features/auth/sign-in-form';

export const metadata: Metadata = { title: 'Anmelden' };
export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>;
}) {
  const { weiter } = await searchParams;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-2xl">Anmelden</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Weiter zu Ihren Kunden und laufenden Beratungen.
        </p>
      </div>

      <SignInForm weiter={weiter} />

      <p className="text-center text-[0.8125rem] text-ink-muted">
        Noch kein Konto?{' '}
        <Link href="/registrieren" className="rounded-sm font-medium text-accent hover:underline">
          Firma einrichten
        </Link>
      </p>
    </div>
  );
}

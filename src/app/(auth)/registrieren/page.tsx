import type { Metadata } from 'next';
import Link from 'next/link';
import { SignUpForm } from '@/features/auth/sign-up-form';

export const metadata: Metadata = { title: 'Firma einrichten' };
export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-2xl">Firma einrichten</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Sie werden Inhaber der Firma und können anschliessend Mitarbeitende einladen.
        </p>
      </div>

      <SignUpForm />

      <p className="text-center text-[0.8125rem] text-ink-muted">
        Bereits ein Konto?{' '}
        <Link href="/anmelden" className="rounded-sm font-medium text-accent hover:underline">
          Anmelden
        </Link>
      </p>
    </div>
  );
}

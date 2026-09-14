import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Passwort zurücksetzen' };
export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-2xl">Passwort zurücksetzen</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Wir schicken Ihnen einen Link, mit dem Sie ein neues Passwort setzen können.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-center text-[0.8125rem] text-ink-muted">
        <Link href="/anmelden" className="rounded-sm font-medium text-accent hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </div>
  );
}

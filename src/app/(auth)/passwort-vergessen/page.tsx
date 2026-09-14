import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Button, Input } from '@/components/ui';

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

      <Alert tone="info">
        Diese Funktion wird in Phase 1 fertiggestellt.
      </Alert>

      <form className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="email" className="text-[0.8125rem] font-medium">E-Mail</label>
          <Input id="email" name="email" type="email" autoComplete="username" disabled
                 placeholder="name@brokerfirma.ch" />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled>Link anfordern</Button>
      </form>

      <p className="text-center text-[0.8125rem] text-ink-muted">
        <Link href="/anmelden" className="rounded-sm font-medium text-accent hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </div>
  );
}

import type { Metadata } from 'next';
import { NewPasswordForm } from '@/features/auth/new-password-form';

export const metadata: Metadata = { title: 'Neues Passwort' };
export const dynamic = 'force-dynamic';

export default function NewPasswordPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-2xl">Neues Passwort</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Wählen Sie ein neues Passwort. Danach sind Sie angemeldet.
        </p>
      </div>
      <NewPasswordForm />
    </div>
  );
}

'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Alert, Button, Input } from '@/components/ui';
import { signIn } from './actions';
import type { AuthState } from './schemas';

const INITIAL: AuthState = { status: 'idle' };

export function SignInForm({ weiter }: { weiter?: string | undefined }) {
  const [state, action, pending] = useActionState(signIn, INITIAL);
  const fieldError = (name: string) =>
    state.status === 'error' ? state.fields?.[name] : undefined;

  return (
    <form action={action} className="grid gap-4">
      {weiter ? <input type="hidden" name="weiter" value={weiter} /> : null}

      {state.status === 'error' && !state.fields ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <div className="grid gap-1.5">
        <label htmlFor="email" className="text-[0.8125rem] font-medium">E-Mail</label>
        <Input
          id="email" name="email" type="email" autoComplete="username"
          required autoFocus placeholder="name@brokerfirma.ch"
          aria-invalid={Boolean(fieldError('email'))}
          aria-describedby={fieldError('email') ? 'email-error' : undefined}
        />
        {fieldError('email') ? (
          <p id="email-error" role="alert" className="text-[0.8125rem] text-danger">{fieldError('email')}</p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="text-[0.8125rem] font-medium">Passwort</label>
          <Link href="/passwort-vergessen" className="rounded-sm text-[0.8125rem] text-ink-muted hover:text-ink">
            Vergessen?
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      <Button type="submit" loading={pending} className="mt-1 w-full" size="lg">
        Anmelden
      </Button>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { Alert, Button, Input } from '@/components/ui';
import { signUp } from './actions';
import type { AuthState } from './schemas';

const INITIAL: AuthState = { status: 'idle' };

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, INITIAL);
  const err = (name: string) => (state.status === 'error' ? state.fields?.[name] : undefined);

  const field = (
    name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement>, hint?: string,
  ) => (
    <div className="grid gap-1.5">
      <label htmlFor={name} className="text-[0.8125rem] font-medium">{label}</label>
      <Input
        id={name} name={name} required
        aria-invalid={Boolean(err(name))}
        aria-describedby={err(name) ? `${name}-error` : hint ? `${name}-hint` : undefined}
        {...props}
      />
      {err(name) ? (
        <p id={`${name}-error`} role="alert" className="text-[0.8125rem] text-danger">{err(name)}</p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-[0.8125rem] text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );

  return (
    <form action={action} className="grid gap-4">
      {state.status === 'error' && !state.fields ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      {field('fullName', 'Ihr Name', { autoComplete: 'name', autoFocus: true, placeholder: 'Peter Muster' })}
      {field('organizationName', 'Firma', { autoComplete: 'organization', placeholder: 'Muster Broker AG' })}
      {field('email', 'E-Mail', { type: 'email', autoComplete: 'username', placeholder: 'name@brokerfirma.ch' })}
      {field('password', 'Passwort', { type: 'password', autoComplete: 'new-password' },
        'Mindestens 12 Zeichen. Eine Passphrase aus mehreren Wörtern ist sicherer als Sonderzeichen.')}

      <Button type="submit" loading={pending} className="mt-1 w-full" size="lg">
        Firma einrichten
      </Button>
    </form>
  );
}

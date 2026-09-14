'use client';

import { useActionState } from 'react';
import { Alert, Button, Input } from '@/components/ui';
import { requestPasswordReset, type PasswordState } from './password-actions';

const INITIAL: PasswordState = { status: 'idle' };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, INITIAL);

  if (state.status === 'sent') {
    return (
      <Alert tone="success" title="E-Mail unterwegs">
        Falls für diese Adresse ein Konto besteht, haben wir einen Link zum Zurücksetzen
        geschickt. Er gilt eine Stunde.
      </Alert>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}
      <div className="grid gap-1.5">
        <label htmlFor="email" className="text-[0.8125rem] font-medium">E-Mail</label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus
               placeholder="name@brokerfirma.ch" />
      </div>
      <Button type="submit" loading={pending} size="lg" className="w-full">Link anfordern</Button>
    </form>
  );
}

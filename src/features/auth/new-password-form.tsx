'use client';

import { useActionState } from 'react';
import { Alert, Button, Input } from '@/components/ui';
import { updatePassword, type PasswordState } from './password-actions';

const INITIAL: PasswordState = { status: 'idle' };

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, INITIAL);

  return (
    <form action={action} className="grid gap-4">
      {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

      <div className="grid gap-1.5">
        <label htmlFor="password" className="text-[0.8125rem] font-medium">Neues Passwort</label>
        <Input id="password" name="password" type="password" autoComplete="new-password"
               required autoFocus aria-describedby="password-hint" />
        <p id="password-hint" className="text-[0.8125rem] text-ink-subtle">
          Mindestens 12 Zeichen. Eine Passphrase aus mehreren Wörtern ist sicherer als Sonderzeichen.
        </p>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="passwordRepeat" className="text-[0.8125rem] font-medium">Wiederholen</label>
        <Input id="passwordRepeat" name="passwordRepeat" type="password"
               autoComplete="new-password" required />
      </div>

      <Button type="submit" loading={pending} size="lg" className="w-full">Passwort speichern</Button>
    </form>
  );
}

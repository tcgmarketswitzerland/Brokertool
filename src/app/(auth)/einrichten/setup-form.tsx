'use client';

import { useActionState } from 'react';
import { Alert, Button, Input } from '@/components/ui';
import { createOrganization, refreshSession } from '@/features/auth/setup-actions';
import type { AuthState } from '@/features/auth/schemas';

const INITIAL: AuthState = { status: 'idle' };

export function SetupForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(createOrganization, INITIAL);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor="organizationName" className="text-[0.8125rem] font-medium">
          Firmenname
        </label>
        <Input id="organizationName" name="organizationName" required autoFocus
               maxLength={200} placeholder="Muster Broker AG" />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="fullName" className="text-[0.8125rem] font-medium">Ihr Name</label>
        <Input id="fullName" name="fullName" required maxLength={200}
               defaultValue={defaultName} placeholder="Peter Muster" />
      </div>

      {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

      <Button type="submit" loading={pending}>Firma anlegen</Button>
    </form>
  );
}

export function RefreshForm() {
  return (
    <form action={refreshSession}>
      <Button type="submit" className="w-full">Sitzung erneuern</Button>
    </form>
  );
}

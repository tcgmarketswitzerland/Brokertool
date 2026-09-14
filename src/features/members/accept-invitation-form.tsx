'use client';

import { useActionState } from 'react';
import { Alert, Button } from '@/components/ui';
import { acceptInvitation } from './accept-invitation';
import type { ActionState } from './schemas';

const INITIAL: ActionState = { status: 'idle' };

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, INITIAL);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}
      <Button type="submit" loading={pending} size="lg" className="w-full">
        Einladung annehmen
      </Button>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { FileText } from 'lucide-react';
import { Alert, Button } from '@/components/ui';
import { startSession, type StartState } from './actions';

const INITIAL: StartState = { status: 'idle' };

export function StartSessionButton({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState(startSession, INITIAL);

  return (
    <div className="grid gap-2">
      <form action={action}>
        <input type="hidden" name="customerId" value={customerId} />
        <Button type="submit" loading={pending}>
          <FileText aria-hidden />Neue Beratung
        </Button>
      </form>
      {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}
    </div>
  );
}

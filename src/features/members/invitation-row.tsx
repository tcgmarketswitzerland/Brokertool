'use client';

import { useActionState } from 'react';
import { Badge, Button } from '@/components/ui';
import { revokeInvitation } from './actions';
import { ROLE_LABEL, type ActionState } from './schemas';
import type { Invitation } from './queries';

const INITIAL: ActionState = { status: 'idle' };

export function InvitationRow({ invitation }: { invitation: Invitation }) {
  const [state, action, pending] = useActionState(revokeInvitation, INITIAL);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{invitation.name ?? invitation.email}</p>
        <p className="truncate text-[0.8125rem] text-ink-muted">
          {invitation.name ? `${invitation.email} · ` : ''}
          {ROLE_LABEL[invitation.role]} · läuft in {invitation.daysLeft}{' '}
          {invitation.daysLeft === 1 ? 'Tag' : 'Tagen'} ab
        </p>
      </div>
      <Badge tone="accent">Offen</Badge>
      <form action={action}>
        <input type="hidden" name="invitationId" value={invitation.id} />
        <Button type="submit" variant="ghost" size="sm" loading={pending}>Zurückziehen</Button>
      </form>
      {state.status === 'error' ? (
        <p role="alert" className="w-full text-[0.8125rem] text-danger">{state.message}</p>
      ) : null}
    </div>
  );
}

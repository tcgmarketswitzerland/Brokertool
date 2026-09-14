'use client';

import { useActionState } from 'react';
import { Badge, Button, Select } from '@/components/ui';
import { changeRole, setMemberActive } from './actions';
import { ORG_ROLES, ROLE_LABEL, type ActionState, type OrgRole } from './schemas';
import type { Member } from './queries';

const INITIAL: ActionState = { status: 'idle' };

export function MemberRow({ member, isSelf, canManage }: {
  member: Member;
  isSelf: boolean;
  canManage: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState(changeRole, INITIAL);
  const [activeState, activeAction, activePending] = useActionState(setMemberActive, INITIAL);
  const error = [roleState, activeState].find((s) => s.status === 'error');

  return (
    <div className="grid gap-2 px-5 py-3.5 sm:grid-cols-[1fr_11rem_auto] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-medium">
          {member.displayName}
          {isSelf ? <Badge>Sie</Badge> : null}
          {!member.isActive ? <Badge tone="warning">Deaktiviert</Badge> : null}
        </p>
        <p className="truncate text-[0.8125rem] text-ink-muted">{member.email}</p>
      </div>

      {canManage && !isSelf ? (
        <form action={roleAction}>
          <input type="hidden" name="memberId" value={member.id} />
          <Select
            name="role"
            defaultValue={member.role}
            disabled={rolePending}
            aria-label={`Rolle von ${member.displayName}`}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            {ORG_ROLES.map((r: OrgRole) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </Select>
        </form>
      ) : (
        <p className="text-sm text-ink-muted">{ROLE_LABEL[member.role]}</p>
      )}

      {canManage && !isSelf ? (
        <form action={activeAction}>
          <input type="hidden" name="memberId" value={member.id} />
          <input type="hidden" name="active" value={String(!member.isActive)} />
          <Button type="submit" variant="ghost" size="sm" loading={activePending}>
            {member.isActive ? 'Deaktivieren' : 'Aktivieren'}
          </Button>
        </form>
      ) : <span />}

      {error?.status === 'error' ? (
        <p role="alert" className="text-[0.8125rem] text-danger sm:col-span-3">{error.message}</p>
      ) : null}
    </div>
  );
}

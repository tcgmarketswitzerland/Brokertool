import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { currentMember, listMembers, listPendingInvitations } from '@/features/members/queries';
import { InvitationRow } from '@/features/members/invitation-row';
import { InviteForm } from '@/features/members/invite-form';
import { MemberRow } from '@/features/members/member-row';

export const metadata: Metadata = { title: 'Benutzer' };
export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const [members, invitations, me] = await Promise.all([
    listMembers(),
    listPendingInvitations(),
    currentMember(),
  ]);

  const canManage = me?.role === 'OWNER' || me?.role === 'ADMIN';

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl">Benutzer</h1>
        <p className="text-sm text-ink-muted">
          Wer in Ihrer Firma mit dem Beratungstool arbeitet — und womit.
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Mitarbeitende einladen</CardTitle>
            <CardDescription>
              Die Einladung gilt nur für die angegebene Adresse. Ein weitergeleiteter Link
              ist damit wertlos.
            </CardDescription>
          </CardHeader>
          <CardContent><InviteForm /></CardContent>
        </Card>
      ) : null}

      {invitations.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Offene Einladungen</CardTitle></CardHeader>
          <div className="divide-y divide-line">
            {invitations.map((i) => <InvitationRow key={i.id} invitation={i} />)}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? 'Person' : 'Personen'}
          </CardDescription>
        </CardHeader>
        <div className="divide-y divide-line">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isSelf={m.id === me?.id}
              canManage={canManage}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

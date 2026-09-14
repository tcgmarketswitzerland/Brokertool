'use client';

import { useActionState, useState } from 'react';
import { Check, Copy, UserPlus } from 'lucide-react';
import { Alert, Button, Input, Select } from '@/components/ui';
import { inviteMember } from './actions';
import { ORG_ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type ActionState } from './schemas';

const INITIAL: ActionState = { status: 'idle' };

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteMember, INITIAL);
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<string>('ADVISOR');

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ohne Zwischenablage-Berechtigung bleibt der Link im Feld lesbar.
    }
  }

  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="grid gap-1.5">
          <label htmlFor="invite-email" className="text-[0.8125rem] font-medium">E-Mail</label>
          <Input id="invite-email" name="email" type="email" required placeholder="name@brokerfirma.ch" />
        </div>

        <div className="grid gap-1.5 sm:w-44">
          <label htmlFor="invite-role" className="text-[0.8125rem] font-medium">Rolle</label>
          <Select id="invite-role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            {ORG_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </Select>
        </div>

        <Button type="submit" loading={pending}>
          <UserPlus aria-hidden />Einladen
        </Button>
      </form>

      <p className="text-[0.8125rem] leading-relaxed text-ink-subtle">
        {ROLE_DESCRIPTION[role as keyof typeof ROLE_DESCRIPTION]}
      </p>

      {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

      {state.status === 'ok' && state.inviteUrl ? (
        <Alert tone="success" title="Einladung erstellt">
          <p className="mt-1">
            Noch verschickt die Anwendung keine E-Mails. Senden Sie diesen Link selbst — er gilt
            sieben Tage und nur für die eingeladene Adresse.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Input readOnly value={state.inviteUrl} className="font-mono text-[0.75rem]"
                   onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="secondary" size="sm" data-compact
                    onClick={() => copy(state.inviteUrl!)}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? 'Kopiert' : 'Kopieren'}
            </Button>
          </div>
        </Alert>
      ) : null}
    </div>
  );
}

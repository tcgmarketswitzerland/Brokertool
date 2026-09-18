'use client';

import { useActionState, useState } from 'react';
import { Check, Copy, UserPlus } from 'lucide-react';
import { Alert, Button, Input, Select } from '@/components/ui';
import { inviteMember } from './actions';
import { ORG_ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type ActionState } from './schemas';

const INITIAL: ActionState = { status: 'idle' };

function Feld({ label, hint, htmlFor, children }: {
  label: string; hint?: string; htmlFor: string; children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[0.8125rem] font-medium">
        {label}
        {hint ? <span className="font-normal text-ink-subtle"> — {hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

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
      <form action={action} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Feld label="Vorname" htmlFor="invite-first">
            <Input id="invite-first" name="firstName" required maxLength={100}
                   autoComplete="off" placeholder="Anna" />
          </Feld>
          <Feld label="Nachname" htmlFor="invite-last">
            <Input id="invite-last" name="lastName" required maxLength={100}
                   autoComplete="off" placeholder="Beispiel" />
          </Feld>
        </div>

        <Feld label="E-Mail" htmlFor="invite-email">
          <Input id="invite-email" name="email" type="email" required
                 placeholder="anna@brokerfirma.ch" />
        </Feld>

        <div className="grid gap-4 sm:grid-cols-2">
          <Feld label="Jobtitel" hint="optional" htmlFor="invite-title">
            <Input id="invite-title" name="jobTitle" maxLength={100}
                   placeholder="Kundenberaterin" />
          </Feld>
          <Feld label="FINMA-Nr." hint="optional" htmlFor="invite-finma">
            <Input id="invite-finma" name="finmaNumber" maxLength={60}
                   className="tabular" placeholder="F01234567" />
          </Feld>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Feld label="Rolle" htmlFor="invite-role">
            <Select id="invite-role" name="role" value={role}
                    onChange={(e) => setRole(e.target.value)}>
              {ORG_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </Select>
          </Feld>

          <Button type="submit" loading={pending}>
            <UserPlus aria-hidden />Einladen
          </Button>
        </div>
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

'use client';

import { useActionState } from 'react';
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Input } from '@/components/ui';
import {
  confirmMfaEnrollment, removeMfaFactor, startMfaEnrollment, type MfaState,
} from './mfa-actions';
import type { MfaFactor } from './queries';
import { formatDate } from '@/domain/shared/date';

const INITIAL: MfaState = { status: 'idle' };

function Enrollment({ state }: { state: Extract<MfaState, { status: 'enrolling' }> | MfaState }) {
  const [confirmState, confirmAction, pending] = useActionState(confirmMfaEnrollment, state);

  const shown = confirmState.status === 'idle' ? state : confirmState;
  const qr = 'qrCode' in shown ? shown.qrCode : undefined;
  const secret = 'secret' in shown ? shown.secret : undefined;
  const factorId = 'factorId' in shown ? shown.factorId : undefined;

  if (shown.status === 'ok') {
    return <Alert tone="success" title="Eingerichtet">{shown.message}</Alert>;
  }
  if (!qr || !factorId) {
    return shown.status === 'error' ? <Alert tone="danger">{shown.message}</Alert> : null;
  }

  return (
    <div className="grid gap-4">
      <ol className="grid gap-3 text-sm leading-relaxed text-ink-muted">
        <li className="grid gap-2">
          <span><span className="font-medium text-ink">1.</span> Code mit einer Authenticator-App scannen.</span>
          {/* Das SVG kommt als data-URI von Supabase. In einem img-Element
              kann darin enthaltenes Skript nicht ausgefuehrt werden. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR-Code für die Authenticator-App"
               className="size-44 rounded-md border border-line bg-white p-2" />
        </li>
        {secret ? (
          <li className="grid gap-1.5">
            <span>
              <span className="font-medium text-ink">2.</span> Oder diesen Schlüssel von Hand eingeben:
            </span>
            <code className="select-all rounded-md border border-line bg-surface-sunken px-2.5 py-1.5 font-mono text-[0.8125rem] tracking-wider text-ink">
              {secret}
            </code>
          </li>
        ) : null}
      </ol>

      <form action={confirmAction} className="grid gap-3 sm:grid-cols-[10rem_auto] sm:items-end">
        <input type="hidden" name="factorId" value={factorId} />
        <div className="grid gap-1.5">
          <label htmlFor="mfa-code" className="text-[0.8125rem] font-medium">
            3. Sechsstelliger Code
          </label>
          <Input id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code"
                 maxLength={6} required placeholder="123456" className="tabular tracking-[0.2em]" />
        </div>
        <Button type="submit" loading={pending}>Aktivieren</Button>
      </form>

      {shown.status === 'error' ? <Alert tone="danger">{shown.message}</Alert> : null}
    </div>
  );
}

export function MfaSetup({ factors }: { factors: MfaFactor[] }) {
  const [startState, startAction, starting] = useActionState(startMfaEnrollment, INITIAL);
  const [removeState, removeAction, removing] = useActionState(removeMfaFactor, INITIAL);

  if (factors.length > 0) {
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone="success"><ShieldCheck aria-hidden />Aktiv</Badge>
          <p className="text-sm text-ink-muted">
            Beim Anmelden wird zusätzlich ein Code aus Ihrer Authenticator-App verlangt.
          </p>
        </div>

        {factors.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 rounded-md border border-line px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{f.friendlyName}</p>
              <p className="text-[0.8125rem] text-ink-subtle">
                Eingerichtet am {formatDate(f.createdAt)}
              </p>
            </div>
            <form action={removeAction}>
              <input type="hidden" name="factorId" value={f.id} />
              <Button type="submit" variant="ghost" size="sm" loading={removing}>
                <Trash2 aria-hidden />Entfernen
              </Button>
            </form>
          </div>
        ))}

        {removeState.status === 'error' ? <Alert tone="danger">{removeState.message}</Alert> : null}
      </div>
    );
  }

  if (startState.status === 'enrolling') {
    return <Enrollment state={startState} />;
  }

  return (
    <div className="grid gap-3">
      {startState.status === 'error' ? <Alert tone="danger">{startState.message}</Alert> : null}
      <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
        Sie verwalten Einkommens-, Vorsorge- und Versicherungsdaten Ihrer Kunden. Eine gestohlene
        Zugangskombination allein soll nicht genügen, um daran zu kommen.
      </p>
      <form action={startAction}>
        <Button type="submit" loading={starting} className="w-fit">
          <KeyRound aria-hidden />Einrichten
        </Button>
      </form>
    </div>
  );
}

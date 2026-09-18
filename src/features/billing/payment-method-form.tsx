'use client';

import { useActionState, useState } from 'react';
import { CreditCard, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Input } from '@/components/ui';
import {
  PAYMENT_KINDS, PAYMENT_KIND_LABEL, PAYMENT_STATUS_LABEL, type PaymentKind,
} from '@/domain/billing/plan';
import { removePaymentMethod, savePaymentMethod } from './actions';
import type { BillingActionState } from './actions';
import type { PaymentMethod } from './queries';

const INITIAL: BillingActionState = { status: 'idle' };

/**
 * Zahlungsmittel der Firma.
 *
 * Hier wird das Mittel gewaehlt, nicht autorisiert. Kartennummern nimmt
 * diese Anwendung an keiner Stelle entgegen - sie gehen direkt an den
 * Zahlungsanbieter, und solange keiner verbunden ist, sagt die Ansicht
 * das auch.
 */
export function PaymentMethodForm({ method }: { method: PaymentMethod | null }) {
  const [state, action, pending] = useActionState(savePaymentMethod, INITIAL);
  const [removeState, removeAction, removing] = useActionState(removePaymentMethod, INITIAL);
  const [kind, setKind] = useState<PaymentKind>(method?.kind ?? 'CARD');

  return (
    <div className="grid gap-5">
      {method ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
          <CreditCard aria-hidden className="size-4 shrink-0 text-ink-subtle" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{PAYMENT_KIND_LABEL[method.kind]}</span>
            {method.label ? (
              <span className="block truncate text-[0.8125rem] text-ink-muted">{method.label}</span>
            ) : null}
          </span>
          <Badge tone={method.status === 'ACTIVE' ? 'success' : 'warning'}>
            {PAYMENT_STATUS_LABEL[method.status]}
          </Badge>
        </div>
      ) : null}

      <form action={action} className="grid gap-4">
        <div role="radiogroup" aria-label="Zahlungsmittel" className="grid gap-2 sm:grid-cols-3">
          {PAYMENT_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-lg border px-4 py-3 text-left text-[0.9375rem] font-medium transition-colors ${
                kind === k
                  ? 'border-accent-border bg-accent-soft text-accent-ink'
                  : 'border-line bg-surface hover:bg-surface-hover'
              }`}
            >
              {PAYMENT_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />

        {kind === 'PAYPAL' ? (
          <div className="grid gap-1.5">
            <label htmlFor="paypal-mail" className="text-[0.8125rem] font-medium">
              E-Mail des PayPal-Kontos
            </label>
            <Input id="paypal-mail" name="reference" type="email" required
                   placeholder="abrechnung@ihrefirma.ch" />
          </div>
        ) : (
          <p className="rounded-md border border-line bg-surface-sunken px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-ink-muted">
            {kind === 'CARD'
              ? 'Die Kartendaten geben Sie beim Zahlungsanbieter ein, nicht hier. Brokertool speichert nie eine Kartennummer.'
              : 'Apple Pay bestätigen Sie auf Ihrem Gerät, sobald der Zahlungsanbieter verbunden ist.'}
          </p>
        )}

        {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={pending}>
            {method ? 'Zahlungsmittel ändern' : 'Zahlungsmittel hinterlegen'}
          </Button>
          {state.status === 'ok' ? (
            <span className="text-[0.8125rem] text-success">{state.message}</span>
          ) : null}
        </div>
      </form>

      {method ? (
        <form action={removeAction} className="border-t border-line pt-4">
          <Button type="submit" variant="ghost" size="sm" loading={removing}>
            <Trash2 aria-hidden />Zahlungsmittel entfernen
          </Button>
          {removeState.status === 'error' ? (
            <p role="alert" className="mt-2 text-[0.8125rem] text-danger">{removeState.message}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

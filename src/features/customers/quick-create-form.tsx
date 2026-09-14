'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Select } from '@/components/ui';
import { CUSTOMER_TYPES, CUSTOMER_TYPE_LABEL } from '@/domain/customer/types';
import { quickCreateCustomer } from './actions';
import type { CustomerActionState } from './schemas';

const INITIAL: CustomerActionState = { status: 'idle' };

/**
 * Schnellanlage: zwei Pflichtfelder. Der haeufigste Grund, warum solche
 * Werkzeuge liegen bleiben, ist die Doppelerfassung gegenueber dem
 * bestehenden Maklersystem (Analyse 1.1).
 */
export function QuickCreateForm() {
  const [state, action, pending] = useActionState(quickCreateCustomer, INITIAL);
  const err = (name: string) => (state.status === 'error' ? state.fields?.[name] : undefined);

  return (
    <form action={action} className="grid gap-4">
      {state.status === 'error' && !state.fields ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="firstName" className="text-[0.8125rem] font-medium">Vorname</label>
          <Input id="firstName" name="firstName" required autoFocus autoComplete="off"
                 aria-invalid={Boolean(err('firstName'))} />
          {err('firstName') ? (
            <p role="alert" className="text-[0.8125rem] text-danger">{err('firstName')}</p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="lastName" className="text-[0.8125rem] font-medium">Nachname</label>
          <Input id="lastName" name="lastName" required autoComplete="off"
                 aria-invalid={Boolean(err('lastName'))} />
          {err('lastName') ? (
            <p role="alert" className="text-[0.8125rem] text-danger">{err('lastName')}</p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="dateOfBirth" className="text-[0.8125rem] font-medium">
            Geburtsdatum <span className="font-normal text-ink-subtle">— optional</span>
          </label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="customerType" className="text-[0.8125rem] font-medium">Art</label>
          <Select id="customerType" name="customerType" defaultValue="PRIVATE">
            {CUSTOMER_TYPES.filter((t) => t !== 'COMPANY').map((t) => (
              <option key={t} value={t}>{CUSTOMER_TYPE_LABEL[t]}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} size="lg">Kunde anlegen</Button>
        <p className="text-[0.8125rem] text-ink-subtle">
          Alles Weitere erfassen Sie im Gespräch.
        </p>
      </div>
    </form>
  );
}

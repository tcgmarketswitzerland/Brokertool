'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Select } from '@/components/ui';
import {
  CUSTOMER_TYPES, CUSTOMER_TYPE_LABEL, LANGUAGES, LANGUAGE_LABEL,
} from '@/domain/customer/types';
import { updateCustomer } from './actions';
import type { CustomerActionState } from './schemas';
import type { CustomerDetail } from './queries';

const INITIAL: CustomerActionState = { status: 'idle' };

export function CustomerSettingsForm({ customer }: { customer: CustomerDetail }) {
  const [state, action, pending] = useActionState(updateCustomer, INITIAL);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="customerId" value={customer.id} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <label htmlFor="customerType" className="text-[0.8125rem] font-medium">Art</label>
          <Select id="customerType" name="customerType" defaultValue={customer.customerType}>
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>{CUSTOMER_TYPE_LABEL[t]}</option>
            ))}
          </Select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="correspondenceLanguage" className="text-[0.8125rem] font-medium">
            Korrespondenzsprache
          </label>
          <Select id="correspondenceLanguage" name="correspondenceLanguage"
                  defaultValue={customer.correspondenceLanguage}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
          </Select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="externalRef" className="text-[0.8125rem] font-medium">
            Kennung im CRM <span className="font-normal text-ink-subtle">— optional</span>
          </label>
          <Input id="externalRef" name="externalRef" defaultValue={customer.externalRef ?? ''} />
        </div>
      </div>

      <p className="text-[0.8125rem] leading-relaxed text-ink-subtle">
        Protokoll und E-Mail an den Kunden entstehen in der Korrespondenzsprache — nicht in Ihrer.
      </p>

      {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

      <div className="flex items-center gap-2">
        <Button type="submit" loading={pending} size="sm">Speichern</Button>
        {state.status === 'ok' ? (
          <span className="text-[0.8125rem] text-success">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Input, Select } from '@/components/ui';
import {
  EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABEL, MARITAL_STATUSES, MARITAL_STATUS_LABEL,
  PERSON_ROLES, PERSON_ROLE_LABEL, SEXES, SEX_LABEL,
} from '@/domain/customer/types';
import { removePerson, savePerson } from './actions';
import type { CustomerActionState } from './schemas';
import type { Person } from './queries';

const INITIAL: CustomerActionState = { status: 'idle' };

function Feld({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[0.8125rem] font-medium">
        {label}
        {hint ? <span className="font-normal text-ink-subtle"> — {hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

export function PersonCard({
  customerId, person, defaultOpen = false,
}: {
  customerId: string;
  person?: Person;
  defaultOpen?: boolean;
}) {
  const [state, action, pending] = useActionState(savePerson, INITIAL);
  const [removeState, removeAction, removing] = useActionState(removePerson, INITIAL);
  const [open, setOpen] = useState(defaultOpen);

  const income = person?.annualIncomeCents != null
    ? String(person.annualIncomeCents / 100)
    : '';

  return (
    <div className="border-b border-line last:border-0">
      <div className="flex items-center gap-3 px-5 py-3.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left"
        >
          <ChevronDown aria-hidden
            className={`size-4 shrink-0 text-ink-subtle transition-transform ${open ? '' : '-rotate-90'}`} />
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {person ? `${person.firstName} ${person.lastName}` : 'Person hinzufügen'}
            </span>
            {person ? (
              <span className="block text-[0.8125rem] text-ink-muted">
                {PERSON_ROLE_LABEL[person.personRole]}
                {person.dateOfBirth
                  ? ` · ${new Date(person.dateOfBirth).toLocaleDateString('de-CH')}`
                  : ''}
              </span>
            ) : null}
          </span>
        </button>
        {person?.personRole === 'PRIMARY' ? <Badge>Hauptperson</Badge> : null}
      </div>

      {open ? (
        <div className="grid gap-4 px-5 pb-5">
          <form action={action} className="grid gap-4">
            <input type="hidden" name="customerId" value={customerId} />
            {person ? <input type="hidden" name="personId" value={person.id} /> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Feld label="Vorname">
                <Input name="firstName" required defaultValue={person?.firstName ?? ''} />
              </Feld>
              <Feld label="Nachname">
                <Input name="lastName" required defaultValue={person?.lastName ?? ''} />
              </Feld>
              <Feld label="Rolle">
                <Select name="personRole" defaultValue={person?.personRole ?? 'PARTNER'}>
                  {PERSON_ROLES.map((r) => (
                    <option key={r} value={r}>{PERSON_ROLE_LABEL[r]}</option>
                  ))}
                </Select>
              </Feld>
              <Feld label="Geburtsdatum" hint="optional">
                <Input name="dateOfBirth" type="date" defaultValue={person?.dateOfBirth ?? ''} />
              </Feld>
              <Feld label="Geschlecht" hint="für die Vorsorgeberechnung">
                <Select name="sex" defaultValue={person?.sex ?? 'UNSPECIFIED'}>
                  {SEXES.map((s) => <option key={s} value={s}>{SEX_LABEL[s]}</option>)}
                </Select>
              </Feld>
              <Feld label="Zivilstand" hint="optional">
                <Select name="maritalStatus" defaultValue={person?.maritalStatus ?? ''}>
                  <option value="">Keine Angabe</option>
                  {MARITAL_STATUSES.map((m) => (
                    <option key={m} value={m}>{MARITAL_STATUS_LABEL[m]}</option>
                  ))}
                </Select>
              </Feld>
              <Feld label="Telefon" hint="optional">
                <Input name="phone" type="tel" inputMode="tel" defaultValue={person?.phone ?? ''} />
              </Feld>
              <Feld label="E-Mail" hint="optional">
                <Input name="email" type="email" defaultValue={person?.email ?? ''} />
              </Feld>
              <Feld label="Beruf" hint="optional">
                <Input name="occupation" defaultValue={person?.occupation ?? ''} />
              </Feld>
              <Feld label="Arbeitgeber" hint="optional">
                <Input name="employer" defaultValue={person?.employer ?? ''} />
              </Feld>
              <Feld label="Anstellung" hint="optional">
                <Select name="employmentType" defaultValue={person?.employmentType ?? ''}>
                  <option value="">Keine Angabe</option>
                  {EMPLOYMENT_TYPES.map((e) => (
                    <option key={e} value={e}>{EMPLOYMENT_TYPE_LABEL[e]}</option>
                  ))}
                </Select>
              </Feld>
              <Feld label="Jahreseinkommen" hint="CHF, optional">
                <Input name="annualIncome" inputMode="decimal" placeholder="95000"
                       defaultValue={income} className="tabular" />
              </Feld>
            </div>

            {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

            <div className="flex items-center gap-2">
              <Button type="submit" loading={pending} size="sm">
                {person ? 'Änderungen speichern' : 'Person hinzufügen'}
              </Button>
              {state.status === 'ok' ? (
                <span className="text-[0.8125rem] text-success">{state.message}</span>
              ) : null}
            </div>
          </form>

          {person && person.personRole !== 'PRIMARY' ? (
            <form action={removeAction} className="border-t border-line pt-3">
              <input type="hidden" name="customerId" value={customerId} />
              <input type="hidden" name="personId" value={person.id} />
              <Button type="submit" variant="ghost" size="sm" loading={removing}>
                <Trash2 aria-hidden />Person entfernen
              </Button>
              {removeState.status === 'error' ? (
                <p role="alert" className="mt-2 text-[0.8125rem] text-danger">{removeState.message}</p>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Alert, Button, Input, Select } from '@/components/ui';
import { formatCHF, rappen } from '@/domain/shared/money';
import {
  POLICY_STATUSES, POLICY_STATUS_LABEL, PREMIUM_FREQUENCIES, PREMIUM_FREQUENCY_LABEL,
} from '@/domain/policy/types';
import { savePolicy } from './actions';
import type { PolicyActionState } from './schemas';
import type { Insurer, Policy } from './queries';

const INITIAL: PolicyActionState = { status: 'idle' };

const franken = (cents: number | null) => (cents === null ? '' : String(cents / 100));

function Feld({ label, hint, error, children }: {
  label: string; hint?: string; error?: string | undefined; children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[0.8125rem] font-medium">
        {label}
        {hint ? <span className="font-normal text-ink-subtle"> — {hint}</span> : null}
      </span>
      {children}
      {error ? <p role="alert" className="text-[0.8125rem] text-danger">{error}</p> : null}
    </div>
  );
}

/**
 * Bestehenden Vertrag erfassen.
 *
 * Oben nur das, was der Kunde im Gespraech aus dem Kopf weiss: Versicherer
 * und Praemie. Alles Weitere steht eingeklappt darunter - das Backoffice
 * erfasst es spaeter nach, wenn die Police vorliegt (ADR-001).
 */
export function PolicyForm({
  customerId, topicId, insurers, persons, policy, onSaved,
}: {
  customerId: string;
  topicId: string;
  insurers: readonly Insurer[];
  persons: readonly { id: string; name: string }[];
  policy?: Policy | undefined;
  onSaved?: (() => void) | undefined;
}) {
  const [state, action, pending] = useActionState(savePolicy, INITIAL);
  const [details, setDetails] = useState(false);
  const [useCatalog, setUseCatalog] = useState(
    policy ? insurers.some((i) => i.name === policy.insurerName) : true,
  );
  const err = (name: string) => (state.status === 'error' ? state.fields?.[name] : undefined);

  if (state.status === 'ok' && onSaved) onSaved();

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="topicId" value={topicId} />
      {policy ? <input type="hidden" name="policyId" value={policy.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Versicherer" error={err('insurerName')}>
          {useCatalog ? (
            <Select
              name="insurerId"
              defaultValue={insurers.find((i) => i.name === policy?.insurerName)?.id ?? ''}
              onChange={(e) => { if (e.target.value === '__frei') setUseCatalog(false); }}
            >
              <option value="">Bitte wählen</option>
              {insurers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              <option value="__frei">Anderer Versicherer …</option>
            </Select>
          ) : (
            <div className="grid gap-1">
              <Input name="insurerName" defaultValue={policy?.insurerName ?? ''}
                     placeholder="Name des Versicherers" />
              <button type="button" onClick={() => setUseCatalog(true)}
                      className="w-fit rounded-sm text-[0.8125rem] text-accent hover:underline">
                Aus der Liste wählen
              </button>
            </div>
          )}
        </Feld>

        <Feld label="Prämie" hint="CHF" error={err('premium')}>
          <div className="flex gap-2">
            <Input name="premium" inputMode="decimal" placeholder="480"
                   defaultValue={franken(policy?.premiumCents ?? null)} className="tabular" />
            <Select name="premiumFrequency" defaultValue={policy?.premiumFrequency ?? 'YEARLY'}
                    className="w-44">
              {PREMIUM_FREQUENCIES.map((f) => (
                <option key={f} value={f}>{PREMIUM_FREQUENCY_LABEL[f]}</option>
              ))}
            </Select>
          </div>
        </Feld>
      </div>

      {persons.length > 1 ? (
        <Feld label="Gilt für" hint="leer lassen für den ganzen Haushalt">
          <Select name="personId" defaultValue={policy?.personId ?? ''}>
            <option value="">Ganzer Haushalt</option>
            {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Feld>
      ) : null}

      <button
        type="button"
        onClick={() => setDetails((v) => !v)}
        aria-expanded={details}
        className="flex w-fit items-center gap-1.5 rounded-sm text-[0.8125rem] font-medium text-ink-muted hover:text-ink"
      >
        <ChevronDown aria-hidden className={`size-3.5 transition-transform ${details ? '' : '-rotate-90'}`} />
        Weitere Angaben
      </button>

      {details ? (
        <div className="grid gap-4 rounded-lg border border-line bg-surface-sunken p-4 sm:grid-cols-2">
          <Feld label="Produkt" hint="optional">
            <Input name="productName" defaultValue={policy?.productName ?? ''}
                   placeholder="Hausratversicherung Komfort" />
          </Feld>
          <Feld label="Policennummer" hint="optional">
            <Input name="policyNumber" defaultValue={policy?.policyNumber ?? ''} />
          </Feld>
          <Feld label="Beginn" hint="optional">
            <Input name="startDate" type="date" defaultValue={policy?.startDate ?? ''} />
          </Feld>
          <Feld label="Ablauf" hint="optional" error={err('endDate')}>
            <Input name="endDate" type="date" defaultValue={policy?.endDate ?? ''} />
          </Feld>
          <Feld label="Deckungssumme" hint="CHF, optional">
            <Input name="sumInsured" inputMode="decimal" className="tabular"
                   defaultValue={franken(policy?.sumInsuredCents ?? null)} placeholder="100000" />
          </Feld>
          <Feld label="Selbstbehalt" hint="CHF, optional">
            <Input name="deductible" inputMode="decimal" className="tabular"
                   defaultValue={franken(policy?.deductibleCents ?? null)} placeholder="200" />
          </Feld>
          <Feld label="Kündigungsfrist" hint="Monate, optional" error={err('noticePeriodMonths')}>
            <Input name="noticePeriodMonths" inputMode="numeric" className="tabular"
                   defaultValue={policy?.noticePeriodMonths?.toString() ?? ''} placeholder="3" />
          </Feld>
          <Feld label="Status">
            <Select name="status" defaultValue={policy?.status ?? 'ACTIVE'}>
              {POLICY_STATUSES.map((s) => (
                <option key={s} value={s}>{POLICY_STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </Feld>
        </div>
      ) : null}

      {policy?.premiumCents != null ? (
        <p className="tabular text-[0.8125rem] text-ink-subtle">
          Entspricht {formatCHF(rappen(
            policy.premiumCents * { MONTHLY: 12, QUARTERLY: 4, SEMIANNUAL: 2, YEARLY: 1, SINGLE: 0 }[policy.premiumFrequency],
          ))} im Jahr.
        </p>
      ) : null}

      {state.status === 'error' && !state.fields ? <Alert tone="danger">{state.message}</Alert> : null}

      <div className="flex items-center gap-2">
        <Button type="submit" loading={pending} size="sm">
          {policy ? 'Änderungen speichern' : 'Vertrag erfassen'}
        </Button>
        {state.status === 'ok' ? (
          <span className="text-[0.8125rem] text-success">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}

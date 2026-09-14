'use client';

import { useActionState, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Badge, Button, TopicIcon } from '@/components/ui';
import { formatCHF, rappen } from '@/domain/shared/money';
import { annualPremiumCents, PREMIUM_FREQUENCY_LABEL } from '@/domain/policy/types';
import { removePolicy } from './actions';
import { PolicyForm } from './policy-form';
import type { PolicyActionState } from './schemas';
import type { Insurer, Policy } from './queries';

const INITIAL: PolicyActionState = { status: 'idle' };

export type TopicOption = { id: string; name: string; icon: string | null };

function PolicyRow({
  policy, customerId, insurers, persons,
}: {
  policy: Policy;
  customerId: string;
  insurers: readonly Insurer[];
  persons: readonly { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(removePolicy, INITIAL);
  const yearly = annualPremiumCents(policy.premiumCents, policy.premiumFrequency);

  return (
    <li className="grid gap-3 px-5 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-muted">
          <TopicIcon name={policy.topicIcon} className="size-[18px]" />
        </span>

        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
                className="min-w-0 flex-1 rounded-md text-left">
          <span className="block truncate font-medium">
            {policy.insurerName}
            <span className="ml-1.5 font-normal text-ink-muted">{policy.topicName}</span>
          </span>
          <span className="tabular block truncate text-[0.8125rem] text-ink-muted">
            {policy.premiumCents != null
              ? `${formatCHF(rappen(policy.premiumCents))} ${PREMIUM_FREQUENCY_LABEL[policy.premiumFrequency]}`
              : 'Keine Prämie erfasst'}
            {yearly != null && policy.premiumFrequency !== 'YEARLY' && yearly > 0
              ? ` · ${formatCHF(rappen(yearly))} im Jahr`
              : ''}
          </span>
        </button>

        {policy.personId ? <Badge>Person</Badge> : <Badge>Haushalt</Badge>}
      </div>

      {open ? (
        <div className="grid gap-4 rounded-lg border border-line bg-surface p-4">
          <PolicyForm customerId={customerId} topicId={policy.topicId} insurers={insurers}
                      persons={persons} policy={policy} />
          <form action={action} className="border-t border-line pt-3">
            <input type="hidden" name="policyId" value={policy.id} />
            <input type="hidden" name="customerId" value={customerId} />
            <Button type="submit" variant="ghost" size="sm" loading={pending}>
              <Trash2 aria-hidden />Vertrag entfernen
            </Button>
            {state.status === 'error' ? (
              <p role="alert" className="mt-2 text-[0.8125rem] text-danger">{state.message}</p>
            ) : null}
          </form>
        </div>
      ) : null}
    </li>
  );
}

export function PolicySection({
  customerId, policies, topics, insurers, persons,
}: {
  customerId: string;
  policies: readonly Policy[];
  topics: readonly TopicOption[];
  insurers: readonly Insurer[];
  persons: readonly { id: string; name: string }[];
}) {
  const [adding, setAdding] = useState<string | null>(null);

  const total = policies.reduce((sum, p) => {
    const yearly = annualPremiumCents(p.premiumCents, p.premiumFrequency);
    return sum + (yearly ?? 0);
  }, 0);

  return (
    <div className="grid">
      {policies.length > 0 ? (
        <ul className="divide-y divide-line border-b border-line">
          {policies.map((p) => (
            <PolicyRow key={p.id} policy={p} customerId={customerId}
                       insurers={insurers} persons={persons} />
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-center text-[0.8125rem] text-ink-muted">
          Noch keine bestehenden Verträge erfasst.
        </p>
      )}

      <div className="grid gap-3 px-5 py-4">
        {total > 0 ? (
          <p className="tabular text-[0.8125rem] text-ink-muted">
            Erfasste Jahresprämien zusammen: <span className="font-medium text-ink">
              {formatCHF(rappen(total))}
            </span>
          </p>
        ) : null}

        {adding ? (
          <div className="grid gap-3 rounded-lg border border-line bg-surface-sunken p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">
                {topics.find((t) => t.id === adding)?.name ?? 'Vertrag'}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setAdding(null)}>Abbrechen</Button>
            </div>
            <PolicyForm customerId={customerId} topicId={adding} insurers={insurers}
                        persons={persons} onSaved={() => setAdding(null)} />
          </div>
        ) : (
          <div className="grid gap-2">
            <p className="text-[0.8125rem] text-ink-subtle">
              Vertrag für eine Sparte erfassen — Versicherer und Prämie genügen.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setAdding(t.id)}
                  className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors hover:bg-surface-hover"
                >
                  <Plus aria-hidden className="size-3.5 text-ink-subtle" />
                  <TopicIcon name={t.icon} className="size-3.5 text-ink-muted" />
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

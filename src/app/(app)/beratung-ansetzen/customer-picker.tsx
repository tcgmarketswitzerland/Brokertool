'use client';

import { useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { CUSTOMER_TYPE_LABEL } from '@/domain/customer/types';
import { scheduleForExisting } from '@/features/advice/schedule-actions';
import type { CustomerListItem } from '@/features/customers/queries';

/**
 * Kunde waehlen.
 *
 * Gesucht wird im Browser und nicht auf dem Server: bis in die Tausende
 * ist die Liste ohnehin schon da, und jeder Tastendruck ohne Wartezeit ist
 * im Gespraech mehr wert als ein sparsamerer Datenabruf.
 */
export function CustomerPicker({
  customers, onNew,
}: {
  customers: readonly CustomerListItem[];
  onNew: () => void;
}) {
  const [term, setTerm] = useState('');

  const found = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return customers.slice(0, 12);
    return customers.filter((c) => c.displayName.toLowerCase().includes(needle)).slice(0, 25);
  }, [customers, term]);

  return (
    <div className="grid gap-4">
      <div className="relative">
        <Search aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Kunde suchen"
          aria-label="Kunde suchen"
          autoFocus
          className="pl-9"
        />
      </div>

      {found.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {found.map((c) => (
            <li key={c.id}>
              <form action={scheduleForExisting}>
                <input type="hidden" name="customerId" value={c.id} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.displayName}</span>
                    <span className="block text-[0.8125rem] text-ink-muted">
                      {CUSTOMER_TYPE_LABEL[c.customerType]}
                      {c.personCount > 1 ? ` · ${c.personCount} Personen` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.8125rem] font-medium text-accent">
                    Beratung ansetzen
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[0.8125rem] text-ink-muted">
          {customers.length === 0
            ? 'Noch keine Kunden erfasst.'
            : `Kein Kunde gefunden für „${term}“.`}
        </p>
      )}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[0.8125rem] text-ink-subtle">oder</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <Button type="button" variant="secondary" size="lg" onClick={onNew}>
        <UserPlus aria-hidden />Neuen Kunden erfassen
      </Button>
    </div>
  );
}

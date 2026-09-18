'use client';

import { useState, useTransition } from 'react';
import { Search, TrendingDown } from 'lucide-react';
import { Alert, Badge, Button, Input, Select } from '@/components/ui';
import { formatAmount, formatCHF, rappen } from '@/domain/shared/money';
import { ageGroupFor } from '@/domain/health/premiums';
import { searchPremiums, type PremiumSearchResult } from './actions';

/**
 * Praemienvergleich der Grundversicherung im Gespraech.
 *
 * Gesucht wird auf Knopfdruck und nicht bei jeder Eingabe: der Kunde
 * schaut mit, und eine Liste, die sich unter dem Finger staendig neu
 * sortiert, ist im Gespraech unbrauchbar.
 */

const MODELS = [
  { value: 'TAR-BASE', label: 'Standard' },
  { value: 'TAR-HAM', label: 'Hausarzt' },
  { value: 'TAR-HMO', label: 'HMO' },
  { value: 'TAR-DIV', label: 'Übrige' },
] as const;

const FRANCHISE_ADULT = [300, 500, 1000, 1500, 2000, 2500];
const FRANCHISE_CHILD = [0, 100, 200, 300, 400, 500, 600];

export type PremiumPerson = {
  id: string;
  name: string;
  birthDate: string | null;
};

export function PremiumComparison({ postalCode, persons, currentPremiumCents }: {
  postalCode?: string | undefined;
  persons?: readonly PremiumPerson[] | undefined;
  /** Monatspraemie des bestehenden Vertrags, fuer den Vergleich. */
  currentPremiumCents?: number | null | undefined;
}) {
  const [plz, setPlz] = useState(postalCode ?? '');
  const [personId, setPersonId] = useState(persons?.[0]?.id ?? '');
  const [ageGroup, setAgeGroup] = useState('AKL-ERW');
  const [franchise, setFranchise] = useState(300);
  const [withAccident, setWithAccident] = useState(true);
  const [models, setModels] = useState<string[]>([]);
  const [result, setResult] = useState<PremiumSearchResult | null>(null);
  const [pending, start] = useTransition();

  const person = persons?.find((p) => p.id === personId);
  // Das Alter aus dem Geburtsdatum schlaegt die Auswahl von Hand: es ist
  // schon erfasst, und im Gespraech zaehlt jeder Handgriff weniger.
  const derived = person?.birthDate
    ? ageGroupFor(person.birthDate, `${new Date().getFullYear() + 1}-01-01`)
    : null;
  const effectiveAge = derived ?? ageGroup;
  const franchises = effectiveAge === 'AKL-KIN' ? FRANCHISE_CHILD : FRANCHISE_ADULT;

  function run(override?: { canton: string; region: number }): void {
    start(async () => {
      setResult(await searchPremiums({
        postalCode: plz,
        ageGroup: effectiveAge,
        franchise: franchises.includes(franchise) ? franchise : (franchises[0] ?? 300),
        withAccident,
        tariffTypes: models,
        ...(override ?? {}),
      }));
    });
  }

  const cheapest = result?.kind === 'offers' ? result.offers[0] : undefined;
  const saving = cheapest && currentPremiumCents
    ? currentPremiumCents - cheapest.premiumCents
    : null;

  return (
    <div className="grid gap-4 rounded-lg border border-line bg-surface-sunken p-4">
      <div className="grid gap-1">
        <p className="text-[0.9375rem] font-semibold">Prämienvergleich Grundversicherung</p>
        <p className="text-[0.8125rem] text-ink-muted">
          Genehmigte Prämien des Bundesamts für Gesundheit.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-[0.8125rem] font-medium">Postleitzahl</span>
          <Input value={plz} onChange={(e) => setPlz(e.target.value)}
                 inputMode="numeric" maxLength={40} placeholder="8004" />
        </label>

        {persons && persons.length > 0 ? (
          <label className="grid gap-1.5">
            <span className="text-[0.8125rem] font-medium">Person</span>
            <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.birthDate ? '' : ' — ohne Geburtsdatum'}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <label className="grid gap-1.5">
            <span className="text-[0.8125rem] font-medium">Altersklasse</span>
            <Select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
              <option value="AKL-KIN">Kind (bis 18)</option>
              <option value="AKL-JUG">Junge Erwachsene (19–25)</option>
              <option value="AKL-ERW">Erwachsene (ab 26)</option>
            </Select>
          </label>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-[0.8125rem] font-medium">Franchise</span>
          <Select value={String(franchise)} onChange={(e) => setFranchise(Number(e.target.value))}>
            {franchises.map((f) => (
              <option key={f} value={f}>CHF {formatAmount(f)}</option>
            ))}
          </Select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.8125rem] font-medium">Unfalldeckung</span>
          <Select value={withAccident ? 'mit' : 'ohne'}
                  onChange={(e) => setWithAccident(e.target.value === 'mit')}>
            <option value="mit">eingeschlossen</option>
            <option value="ohne">über Arbeitgeber gedeckt</option>
          </Select>
        </label>
      </div>

      <div className="grid gap-1.5">
        <span className="text-[0.8125rem] font-medium">
          Modelle <span className="font-normal text-ink-subtle">— nichts gewählt heisst alle</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {MODELS.map((m) => {
            const on = models.includes(m.value);
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={on}
                onClick={() => setModels((prev) =>
                  on ? prev.filter((x) => x !== m.value) : [...prev, m.value])}
                className={`rounded-md border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                  on ? 'border-accent-border bg-accent-soft text-accent-ink'
                     : 'border-line bg-surface text-ink-muted hover:bg-surface-hover'}`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <Button type="button" onClick={() => run()} loading={pending} className="w-fit">
        <Search aria-hidden />Prämien suchen
      </Button>

      {result?.kind === 'unknown_postal_code' ? (
        <Alert tone="warning" title="Postleitzahl nicht gefunden">
          Bitte eine vierstellige Schweizer Postleitzahl eingeben.
        </Alert>
      ) : null}

      {result?.kind === 'choose_region' ? (
        <div className="grid gap-2">
          <Alert tone="info" title="Diese Postleitzahl liegt in mehreren Prämienregionen">
            Die Prämie hängt an der Gemeinde, nicht an der Postleitzahl. Bitte wählen.
          </Alert>
          <div className="flex flex-wrap gap-1.5">
            {result.regions.map((r) => (
              <button
                key={`${r.canton}-${r.region}-${r.municipality}`}
                type="button"
                onClick={() => run({ canton: r.canton, region: r.region })}
                className="rounded-md border border-line bg-surface px-3 py-1.5 text-[0.8125rem] font-medium transition-colors hover:bg-surface-hover"
              >
                {r.municipality} <span className="text-ink-subtle">{r.canton}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {result?.kind === 'offers' ? (
        result.offers.length === 0 ? (
          <Alert tone="warning" title="Keine Prämien gefunden">
            Für diese Kombination gibt es keine Angebote. Andere Franchise oder anderes Modell?
          </Alert>
        ) : (
          <div className="grid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[0.8125rem] text-ink-muted">
                {result.offers.length} Angebote · {result.region.canton} Region{' '}
                {result.region.region} · Prämienjahr {result.year}
              </p>
              {saving !== null && saving > 0 ? (
                <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-success">
                  <TrendingDown aria-hidden className="size-3.5" />
                  bis {formatCHF(rappen(saving))} im Monat günstiger
                </span>
              ) : null}
            </div>

            <div className="max-h-96 overflow-y-auto rounded-lg border border-line bg-surface">
              <table className="w-full text-[0.8125rem]">
                <thead className="sticky top-0 border-b border-line bg-surface-sunken text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Versicherer</th>
                    <th className="px-3 py-2 font-medium">Modell</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium">im Monat</th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-line">
                  {result.offers.map((o, i) => (
                    <tr key={`${o.insurerNumber}-${o.product}-${i}`}
                        className={i === 0 ? 'bg-success-soft/40' : undefined}>
                      <td className="px-3 py-2">
                        {o.insurerName}
                        {i === 0 ? <Badge tone="success" className="ml-2">günstigste</Badge> : null}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">{o.product}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                        {formatCHF(rappen(o.premiumCents))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[0.75rem] leading-relaxed text-ink-subtle">
              Genehmigte Prämien des Bundesamts für Gesundheit für {result.year}. Massgebend ist
              die Offerte des Versicherers; Zusatzversicherungen sind nicht enthalten.
            </p>
          </div>
        )
      ) : null}
    </div>
  );
}

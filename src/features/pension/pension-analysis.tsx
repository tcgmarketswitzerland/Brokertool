'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Info, Users } from 'lucide-react';
import { Alert, Card, CardHeader, CardTitle, Input, Select } from '@/components/ui';
import { PensionChart } from '@/components/charts/pension-chart';
import { analysePension } from '@/domain/pension/analysis';
import {
  PENSION_CASES, PENSION_CASE_LABEL, PILLAR_SHORT,
  type Benefit, type Household, type PensionCase,
} from '@/domain/pension/types';
import { BENEFIT_ROWS } from './benefit-rows';
import { savePensionAnalysis } from './actions';

/**
 * Die Vorsorgeanalyse im Gespraech.
 *
 * Alle Felder sind leer. Es gibt keine Vorbelegung, auch keine
 * "uebliche" Zielquote: eine vorgegebene Zahl waere eine Aussage, die
 * niemand getroffen hat, und sie stuende spaeter im Protokoll, als haette
 * der Berater sie gemacht.
 *
 * Gerechnet wird sofort im Browser, waehrend getippt wird. Die Grafik ist
 * das, was der Kunde ansieht - sie muss sich mitbewegen, sonst ist sie
 * ein Bericht statt eines Gespraechs.
 */

const money = (value: string): number => {
  const cleaned = value.replace(/['\s]/g, '').replace(',', '.');
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) : 0;
};

function Feld({ label, hint, children }: {
  label: string; hint?: string | undefined; children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[0.8125rem] font-medium">
        {label}
        {hint ? <span className="font-normal text-ink-subtle"> — {hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export type PensionInitial = {
  income: string;
  target: string;
  hasPartner: boolean;
  partnerIncome: string;
  children: string;
  values: Record<string, string>;
};

export function PensionAnalysis({ session, initial }: {
  /** Fehlt sie, laeuft die Analyse als Vorschau ohne Speichern. */
  session?: { sessionId: string; customerId: string } | undefined;
  initial?: PensionInitial | undefined;
}) {
  const [income, setIncome] = useState(initial?.income ?? '');
  const [target, setTarget] = useState(initial?.target ?? '');
  const [hasPartner, setHasPartner] = useState(initial?.hasPartner ?? false);
  const [partnerIncome, setPartnerIncome] = useState(initial?.partnerIncome ?? '');
  const [children, setChildren] = useState(initial?.children ?? '0');
  const [values, setValues] = useState<Record<string, string>>(initial?.values ?? {});
  const [openCase, setOpenCase] = useState<PensionCase>('DEATH');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle');

  const household: Household = useMemo(() => ({
    annualIncomeCents: income.trim() === '' ? null : money(income),
    hasPartner,
    partnerIncomeCents: partnerIncome.trim() === '' ? null : money(partnerIncome),
    childCount: Number(children) || 0,
    targetPercent: target.trim() === '' ? null : Number(target.replace(',', '.')) || null,
  }), [income, hasPartner, partnerIncome, children, target]);

  const result = useMemo(() => {
    const benefits = Object.fromEntries(PENSION_CASES.map((c) => [
      c,
      BENEFIT_ROWS[c]
        .map((row): Benefit => ({
          pillar: row.pillar,
          label: row.label,
          annualCents: row.perChild ? 0 : money(values[row.key] ?? ''),
          perChildCents: row.perChild ? money(values[row.key] ?? '') : 0,
          requiresPartner: row.requiresPartner,
        }))
        .filter((b) => b.annualCents > 0 || b.perChildCents > 0),
    ])) as Record<PensionCase, Benefit[]>;

    return analysePension({ household, benefits });
  }, [household, values]);

  const set = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  // Gespeichert wird verzoegert, nicht bei jedem Tastendruck: im Gespraech
  // tippt der Berater Betraege in einem Zug, und ein Speichervorgang je
  // Ziffer waere sinnlose Last - und bei wackligem Netz eine Fehlerquelle.
  const first = useRef(true);
  useEffect(() => {
    if (!session) return;
    if (first.current) { first.current = false; return; }

    setSaved('saving');
    const timer = window.setTimeout(() => {
      const benefits = Object.fromEntries(PENSION_CASES.map((c) => [
        c,
        BENEFIT_ROWS[c]
          .map((row) => ({
            key: row.key,
            pillar: row.pillar,
            label: row.label,
            annualCents: row.perChild ? 0 : money(values[row.key] ?? ''),
            perChildCents: row.perChild ? money(values[row.key] ?? '') : 0,
            requiresPartner: row.requiresPartner,
          }))
          .filter((b) => b.annualCents > 0 || b.perChildCents > 0),
      ]));

      void savePensionAnalysis({
        sessionId: session.sessionId,
        customerId: session.customerId,
        annualIncomeCents: household.annualIncomeCents,
        hasPartner: household.hasPartner,
        partnerIncomeCents: household.partnerIncomeCents,
        childCount: household.childCount,
        targetPercent: household.targetPercent,
        values,
        benefits,
      }).then((r) => setSaved(r.status === 'ok' ? 'done' : 'failed'));
    }, 900);

    return () => window.clearTimeout(timer);
  }, [session, household, values]);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users aria-hidden className="size-4 text-ink-subtle" />
            Haushalt
          </CardTitle>
        </CardHeader>
        <div className="grid gap-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Feld label="Jahreseinkommen" hint="brutto">
              <Input value={income} onChange={(e) => setIncome(e.target.value)}
                     inputMode="decimal" placeholder="" />
            </Feld>
            <Feld label="Gewünschte Absicherung" hint="Prozent des Einkommens">
              <Input value={target} onChange={(e) => setTarget(e.target.value)}
                     inputMode="decimal" placeholder="" />
            </Feld>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Feld label="Partnerin oder Partner">
              <Select value={hasPartner ? 'ja' : 'nein'}
                      onChange={(e) => setHasPartner(e.target.value === 'ja')}>
                <option value="nein">Nein</option>
                <option value="ja">Ja</option>
              </Select>
            </Feld>
            {hasPartner ? (
              <Feld label="Einkommen Partner/in" hint="brutto">
                <Input value={partnerIncome} onChange={(e) => setPartnerIncome(e.target.value)}
                       inputMode="decimal" placeholder="" />
              </Feld>
            ) : null}
            <Feld label="Kinder" hint="mit Anspruch auf Kinderrenten">
              <Input value={children} onChange={(e) => setChildren(e.target.value)}
                     inputMode="numeric" type="number" min={0} max={12} />
            </Feld>
          </div>

          <p className="flex gap-2 text-[0.8125rem] leading-relaxed text-ink-subtle">
            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            Partnerin und Kinder verändern, welche Renten überhaupt anfallen. Ohne sie
            entfallen Witwen-, Waisen- und Kinderrenten — die Lücke ist dann eine andere.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leistungen aus dem Vorsorgeausweis</CardTitle>
        </CardHeader>

        <div className="flex flex-wrap gap-1.5 border-b border-line px-5 pb-3">
          {PENSION_CASES.map((c) => {
            const filled = BENEFIT_ROWS[c].some((r) => money(values[r.key] ?? '') > 0);
            return (
              <button
                key={c}
                type="button"
                onClick={() => setOpenCase(c)}
                aria-current={openCase === c ? 'true' : undefined}
                className={`rounded-md border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                  openCase === c
                    ? 'border-accent-border bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface text-ink-muted hover:bg-surface-hover'
                }`}
              >
                {PENSION_CASE_LABEL[c].replace('Erwerbsunfähigkeit durch ', '')}
                {filled ? <span aria-label="ausgefüllt" className="ml-1.5 text-success">•</span> : null}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 px-5 py-4">
          <p className="text-[0.8125rem] leading-relaxed text-ink-muted">
            Jahresbeträge in Franken, abgelesen vom Vorsorgeausweis und vom AHV-Konto.
            Leere Felder zählen als null — nichts wird geschätzt.
          </p>

          {BENEFIT_ROWS[openCase].map((row) => {
            const inactive = row.requiresPartner && !hasPartner;
            return (
              <div key={row.key}
                   className={`grid gap-3 sm:grid-cols-[1fr_9rem] sm:items-center ${
                     inactive ? 'opacity-45' : ''}`}>
                <span className="text-[0.9375rem]">
                  {row.label}
                  <span className="ml-1.5 text-[0.75rem] text-ink-subtle">
                    {PILLAR_SHORT[row.pillar]}
                    {row.hint ? ` · ${row.hint}` : ''}
                    {inactive ? ' · kein Partner erfasst' : ''}
                  </span>
                </span>
                <Input
                  value={values[row.key] ?? ''}
                  onChange={(e) => set(row.key, e.target.value)}
                  inputMode="decimal"
                  disabled={inactive}
                  aria-label={`${row.label} — Jahresbetrag`}
                  className="tabular text-right"
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Ihre Situation im Ernstfall</span>
            {session ? (
              <span className="text-[0.75rem] font-normal text-ink-subtle">
                {saved === 'saving' ? 'wird gespeichert …'
                  : saved === 'done' ? 'gespeichert'
                    : saved === 'failed' ? 'nicht gespeichert' : ''}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <div className="grid gap-4 px-5 py-4">
          {result.isEmpty ? (
            <p className="py-8 text-center text-[0.8125rem] text-ink-muted">
              Sobald Sie Beträge eintragen, entsteht hier die Grafik.
            </p>
          ) : (
            <>
              <PensionChart result={result} />

              {result.largestGap ? (
                <Alert tone="warning" title="Die grösste Lücke">
                  {PENSION_CASE_LABEL[result.largestGap.pensionCase]}
                  {result.cases.find((c) => c.pensionCase === 'DISABILITY_ILLNESS')?.gapCents
                    && result.largestGap.pensionCase === 'DISABILITY_ILLNESS' ? (
                    <> — der Fall, den die Unfallversicherung nicht abdeckt.</>
                  ) : null}
                </Alert>
              ) : null}
            </>
          )}

          <p className="border-t border-line pt-3 text-[0.8125rem] leading-relaxed text-ink-subtle">
            Diese Auswertung ist eine Grobanalyse auf Grundlage der im Gespräch genannten
            Angaben. Sie ersetzt weder eine Berechnung Ihrer Vorsorgeeinrichtung noch eine
            verbindliche Leistungszusage eines Versicherers. Massgebend sind ausschliesslich
            die Angaben Ihrer Vorsorgeeinrichtung und die Bedingungen Ihrer Policen.
          </p>
        </div>
      </Card>
    </div>
  );
}

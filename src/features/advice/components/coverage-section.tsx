'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { formatCHF, rappen } from '@/domain/shared/money';
import { annualPremiumCents, PREMIUM_FREQUENCY_LABEL } from '@/domain/policy/types';
import {
  COVERAGE_CHOICES, COVERAGE_CHOICE_LABEL,
} from '@/domain/advice/status';
import type { CoverageState } from '@/domain/advice/status';
import { PolicyForm } from '@/features/policies/policy-form';
import type { Insurer, Policy } from '@/features/policies/queries';
import { DocumentShelf } from '@/features/documents/document-shelf';
import type { CustomerDocument } from '@/features/documents/queries';
import { Choice } from './choice';

/** Was die Seite aus dem Kundendossier mitgibt, damit der Beratungsmodus
 *  selbst keine Datenbank kennen muss. */
export type Dossier = {
  readonly customerId: string;
  readonly sessionId: string;
  readonly policies: readonly Policy[];
  readonly documents: readonly CustomerDocument[];
  readonly insurers: readonly Insurer[];
  readonly persons: readonly { id: string; name: string }[];
};

function PolicyCard({ policy }: { policy: Policy }) {
  const yearly = annualPremiumCents(policy.premiumCents, policy.premiumFrequency);

  return (
    <li className="grid gap-1 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{policy.insurerName}</span>
        {policy.personId ? <Badge>Person</Badge> : <Badge>Haushalt</Badge>}
      </div>

      {policy.productName ? (
        <span className="truncate text-[0.8125rem] text-ink-muted">{policy.productName}</span>
      ) : null}

      <span className="tabular text-[0.8125rem] text-ink-muted">
        {policy.premiumCents != null
          ? `${formatCHF(rappen(policy.premiumCents))} ${PREMIUM_FREQUENCY_LABEL[policy.premiumFrequency]}`
          : 'Keine Prämie erfasst'}
        {yearly != null && policy.premiumFrequency !== 'YEARLY' && yearly > 0
          ? ` · ${formatCHF(rappen(yearly))} im Jahr`
          : ''}
        {policy.policyNumber ? ` · Police ${policy.policyNumber}` : ''}
      </span>
    </li>
  );
}

/**
 * Aktueller Versicherungsschutz in einer Sparte.
 *
 * Drei Antworten und was daraus folgt: bei "Bestehende Police" zeigt der
 * Abschnitt, was beim Kunden erfasst ist, und laesst eine weitere Police
 * gleich im Gespraech aufnehmen. Der Berater soll nicht das Dossier in
 * einem zweiten Tab suchen muessen, waehrend der Kunde vor ihm sitzt.
 */
export function CoverageSection({
  topicId, coverageState, dossier, onSelect,
}: {
  topicId: string;
  coverageState: CoverageState;
  dossier: Dossier | undefined;
  onSelect: (state: CoverageState) => void;
}) {
  const router = useRouter();
  const [capturing, setCapturing] = useState(false);

  const policies = (dossier?.policies ?? []).filter((p) => p.topicId === topicId);
  const documents = (dossier?.documents ?? []).filter((d) => d.topicId === topicId);
  const showDossier = coverageState === 'COVER_EXISTS';

  function saved() {
    setCapturing(false);
    // Die erfasste Police kommt vom Server; der Beratungszustand im Browser
    // bleibt dabei stehen, weil er nur beim ersten Rendern aus den Props
    // gelesen wird.
    router.refresh();
  }

  return (
    <fieldset className="grid gap-2.5">
      <legend className="mb-1 text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
        Aktueller Versicherungsschutz
      </legend>

      <div role="radiogroup" aria-label="Aktueller Versicherungsschutz"
           className="grid gap-2 sm:grid-cols-3">
        {COVERAGE_CHOICES.map((s) => (
          <Choice key={s} checked={coverageState === s} onClick={() => onSelect(s)}>
            {COVERAGE_CHOICE_LABEL[s]}
          </Choice>
        ))}
      </div>

      {/* Eine erfasste Police und "keine Deckung" widersprechen sich. Statt
          die Auswahl zu verbieten - der Kunde kann gerade gekuendigt haben -
          wird der Widerspruch benannt. */}
      {coverageState === 'NO_COVER' && policies.length > 0 ? (
        <p className="rounded-md border border-warning/25 bg-warning-soft px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-warning">
          Im Dossier {policies.length === 1 ? 'ist' : 'sind'} für diese Sparte{' '}
          {policies.length === 1 ? 'eine Police' : `${policies.length} Policen`} erfasst.
          Falls der Vertrag nicht mehr läuft, halten Sie das unten fest.
        </p>
      ) : null}

      {showDossier ? (
        <div className="grid gap-2.5">
          {policies.length > 0 ? (
            <ul className="grid gap-2">
              {policies.map((p) => <PolicyCard key={p.id} policy={p} />)}
            </ul>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-3 text-[0.8125rem] text-ink-muted">
              <FileText aria-hidden className="size-4 shrink-0 text-ink-subtle" />
              Für diese Sparte ist beim Kunden noch keine Police erfasst.
            </p>
          )}

          {dossier ? (
            capturing ? (
              <div className="grid gap-3 rounded-lg border border-line bg-surface-sunken p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">Police erfassen</p>
                  <Button variant="ghost" size="sm" onClick={() => setCapturing(false)}>
                    Abbrechen
                  </Button>
                </div>
                <PolicyForm
                  customerId={dossier.customerId}
                  topicId={topicId}
                  insurers={dossier.insurers}
                  persons={dossier.persons}
                  onSaved={saved}
                />
              </div>
            ) : (
              <Button variant="secondary" size="sm" className="w-fit"
                      onClick={() => setCapturing(true)}>
                <Plus aria-hidden />Police erfassen
              </Button>
            )
          ) : null}
        </div>
      ) : null}

      {/* Unterlagen zur Sparte. Bewusst unabhaengig von der Antwort oben:
          auch ohne bestehende Deckung liegt hier schon mal eine Offerte. */}
      {dossier ? (
        <div className="grid gap-2 pt-1">
          <p className="text-[0.8125rem] font-medium text-ink-muted">Unterlagen</p>
          <DocumentShelf
            customerId={dossier.customerId}
            sessionId={dossier.sessionId}
            topicId={topicId}
            documents={documents}
          />
        </div>
      ) : null}
    </fieldset>
  );
}

'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Check, PenLine, User, UserRound } from 'lucide-react';
import {
  Alert, Badge, Button, Card, CardDescription, CardHeader, CardTitle, Input, TopicIcon,
} from '@/components/ui';
import { formatCHF, rappen } from '@/domain/shared/money';
import { TASK_OWNER_LABEL } from '@/domain/task/types';
import type { SuggestedTask } from '@/domain/task/suggestions';
import type { SummaryDocument } from '@/domain/advice/summary';
import { topicNarrative } from '@/domain/advice/protocol';
import { completeSession, type CompleteState } from './actions';
import { SignaturePad } from './signature-pad';

const INITIAL: CompleteState = { status: 'idle' };

function dueLabel(days: number | null): string {
  if (days === null) return 'ohne Frist';
  if (days === 1) return 'in 1 Tag';
  return `in ${days} Tagen`;
}

/**
 * Der Abschluss (Konzeptpunkt 29).
 *
 * Drei Dinge, in dieser Reihenfolge: was noch fehlt, was das Protokoll
 * sagen wird, und welche Folgeaufgaben entstehen. Die Aufgaben sind
 * vorausgewaehlt - der Berater bestaetigt, statt zu erfassen. Das ist der
 * Unterschied zwischen einem Werkzeug und einem weiteren Formular.
 */
export function CompletionView({
  sessionId, document, suggestions, untouched, blocked,
}: {
  sessionId: string;
  document: SummaryDocument;
  suggestions: readonly SuggestedTask[];
  /** Sparten, die als "nicht thematisiert" ins Protokoll gehen. */
  untouched: readonly string[];
  blocked: boolean;
}) {
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(
    () => new Set(suggestions.map((s) => s.key)),
  );
  const [signature, setSignature] = useState<string | null>(null);
  const [state, action, pending] = useActionState(completeSession, INITIAL);

  function toggle(key: string): void {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-5 py-6">
      <div className="grid gap-2">
        <Link href={`/beratung/${sessionId}`}
              className="flex w-fit items-center gap-1.5 rounded-sm text-[0.8125rem] text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-3.5" />Zurück ins Gespräch
        </Link>
        <h1 className="text-2xl">Beratung abschliessen</h1>
        <p className="text-sm text-ink-muted">
          {document.customerName}
          {document.participants.length > 0 ? ` · ${document.participants.join(', ')}` : ''}
        </p>
      </div>

      {blocked ? (
        <Alert tone="warning" title="Noch keine Sparte besprochen">
          Eine Beratung ohne eine einzige besprochene Sparte lässt sich nicht abschliessen —
          ihr Protokoll würde nichts belegen.
        </Alert>
      ) : null}

      {untouched.length > 0 ? (
        <Alert tone="info" title={
          untouched.length === 1
            ? 'Eine Sparte wird als nicht thematisiert festgehalten'
            : `${untouched.length} Sparten werden als nicht thematisiert festgehalten`
        }>
          <p className="mb-2">
            Sie verschwinden nicht aus dem Protokoll — dort steht zu jeder der Satz, dass sie
            im Gespräch nicht behandelt wurde. Das ist ehrlicher als eine Lücke und schützt Sie
            besser als eine Formulierung, die nach Beratung klingt.
          </p>
          <ul className="grid gap-1">
            {untouched.map((name) => (
              <li key={name} className="flex items-center gap-1.5">
                <AlertTriangle aria-hidden className="size-3.5 shrink-0" />{name}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Besprochen', `${document.counts.discussed}/${document.counts.total}`],
          ['Handlungsbedarf', String(document.counts.actionNeeded)],
          ['Kein Bedarf', String(document.counts.noAction)],
          ['Abgelehnt', String(document.counts.declined)],
        ].map(([label, value]) => (
          <Card key={label}>
            <div className="grid gap-1 p-4">
              <p className="text-[0.8125rem] text-ink-muted">{label}</p>
              <p className="tabular text-xl font-semibold">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Das kommt ins Protokoll</CardTitle></CardHeader>
        <ul className="divide-y divide-line">
          {document.topics.map((topic) => {
            // Derselbe Text wie im PDF, aus derselben Funktion. Eine
            // Vorschau, die etwas anderes zeigt als das Ergebnis, waere
            // schlimmer als gar keine - gerade beim Ablehnungssatz, den
            // der Berater hier zum letzten Mal vor dem Einfrieren sieht.
            const narrative = topicNarrative(topic, document);
            return (
              <li key={topic.slug} className="grid gap-1 px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <TopicIcon name={topic.icon} className="size-4 text-ink-muted" />
                    {topic.name}
                  </span>
                  <Badge tone={
                    topic.outcome === 'NO_ACTION_NEEDED' ? 'success'
                      : topic.wasSkipped || topic.outcome === null ? 'neutral'
                        : topic.outcome === 'CLIENT_DECLINED' ? 'warning' : 'accent'
                  }>
                    {topic.outcomeLabel}
                  </Badge>
                </div>
                {topic.existingPolicies.length > 0 ? (
                  <p className="tabular text-[0.8125rem] text-ink-subtle">
                    Bestehende Lösung: {topic.existingPolicies.map((p) => p.insurerName).join(', ')}
                  </p>
                ) : null}
                {narrative ? (
                  <p className="whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-muted">
                    {narrative}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        {document.totalAnnualPremiumCents > 0 ? (
          <p className="tabular border-t border-line px-5 py-3 text-[0.8125rem] text-ink-muted">
            Erfasste Jahresprämien: <span className="font-medium text-ink">
              {formatCHF(rappen(document.totalAnnualPremiumCents))}
            </span>
          </p>
        ) : null}
      </Card>

      <form action={action} className="grid gap-6">
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="acceptedKeys" value={JSON.stringify([...accepted])} />

        <Card>
          <CardHeader>
            <CardTitle>Folgeaufgaben</CardTitle>
            <CardDescription>
              Aus den Ergebnissen abgeleitet und vorausgewählt. Abwählen, was nicht bleiben
              soll — der Rest wird mit dem Abschluss angelegt und steht im Protokoll.
            </CardDescription>
          </CardHeader>

          {suggestions.length === 0 ? (
            <p className="px-5 py-6 text-center text-[0.8125rem] text-ink-muted">
              Aus diesem Gespräch ergeben sich keine Folgeaufgaben.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {suggestions.map((s) => {
                const on = accepted.has(s.key);
                const Owner = s.ownerType === 'CUSTOMER' ? UserRound : User;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(s.key)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-hover"
                    >
                      <span className={`flex size-5 shrink-0 items-center justify-center rounded-[0.25rem] border transition-colors ${
                        on ? 'border-accent bg-accent text-ink-inverted' : 'border-line-strong'
                      }`}>
                        {on ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[0.9375rem] ${on ? 'font-medium' : 'text-ink-muted'}`}>
                          {s.title}
                        </span>
                        <span className="flex items-center gap-1.5 text-[0.8125rem] text-ink-subtle">
                          <Owner aria-hidden className="size-3.5" />
                          {TASK_OWNER_LABEL[s.ownerType]} · {dueLabel(s.dueInDays)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenLine aria-hidden className="size-4 text-ink-subtle" />
              Bestätigung durch den Kunden
            </CardTitle>
          </CardHeader>
          <div className="grid gap-4 px-5 py-4">
            <p className="text-[0.9375rem] leading-relaxed">
              Ich bestätige, dass die oben aufgeführten Themen mit mir besprochen wurden und
              dass meine Entscheidungen richtig wiedergegeben sind.
            </p>

            <div className="grid gap-1.5">
              <label htmlFor="signer" className="text-[0.8125rem] font-medium">
                Wer unterschreibt
              </label>
              <Input id="signer" name="signerName" defaultValue={document.customerName}
                     maxLength={200} />
            </div>

            <SignaturePad label="Unterschrift des Kunden" onChange={setSignature} />
            <input type="hidden" name="signature" value={signature ?? ''} />

            <p className="text-[0.8125rem] leading-relaxed text-ink-subtle">
              Die Unterschrift ist freiwillig — ohne sie lässt sich die Beratung ebenso
              abschliessen. Mit ihr belegt das Protokoll zusätzlich, dass der Kunde den
              festgehaltenen Inhalt gesehen hat.
            </p>
          </div>
        </Card>

        {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

        <div className="grid gap-2">
          <Button type="submit" size="lg" loading={pending} disabled={blocked}>
            Beratung abschliessen
          </Button>
          <p className="text-center text-[0.8125rem] leading-relaxed text-ink-subtle">
            Der Abschluss friert das Protokoll ein. Danach sind keine Änderungen mehr
            möglich — auch nicht durch die Administration.
          </p>
        </div>
      </form>
    </div>
  );
}

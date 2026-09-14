'use client';

import { useId } from 'react';
import { EyeOff, Users } from 'lucide-react';
import { TopicIcon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { COVERAGE_LABEL, COVERAGE_STATES, OUTCOMES, OUTCOME_LABEL } from '@/domain/advice/status';
import type { CommandPayload } from '@/domain/advice/commands';
import type { NoteState, TopicState } from '@/domain/advice/session-state';

/**
 * Eine Versicherungssparte im Gespraech.
 *
 * Drei Entscheidungen, in der Reihenfolge, in der sie fallen:
 *   1. Besteht ueberhaupt eine Deckung?  (Befund)
 *   2. Was moechte der Kunde?            (Entscheidung)
 *   3. Was ist dazu zu notieren?
 *
 * Grosse Flaechen statt Auswahlmenues: der Berater tippt im Gespraech mit
 * einem Finger, oft ohne hinzusehen.
 */

function Choice({
  checked, onClick, children, color,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string | undefined;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        'rounded-lg border px-4 py-3 text-left text-[0.9375rem] font-medium transition-colors',
        checked
          ? 'border-transparent text-ink-inverted'
          : 'border-line bg-surface text-ink hover:bg-surface-hover',
      )}
      style={checked ? { backgroundColor: color ?? 'var(--color-accent)' } : undefined}
    >
      {children}
    </button>
  );
}

const OUTCOME_COLOR: Partial<Record<(typeof OUTCOMES)[number], string>> = {
  NO_ACTION_NEEDED: 'var(--status-no-action)',
  ACTION_REQUIRED: 'var(--status-action)',
  OFFER_REQUESTED: 'var(--status-action)',
  CONTRACT_REQUESTED: 'var(--status-action)',
  FOLLOW_UP: 'var(--status-follow-up)',
  CLIENT_DECLINED: 'var(--status-declined)',
};

export function TopicDetail({
  topic, name, notes, onCommand,
}: {
  topic: TopicState;
  name: string;
  notes: readonly NoteState[];
  onCommand: (payload: CommandPayload) => void;
}) {
  const noteId = useId();
  const shared = notes.find((n) => n.visibility === 'SHARED' && n.topicId === topic.topicId);
  const internal = notes.find((n) => n.visibility === 'INTERNAL' && n.topicId === topic.topicId);

  // Eine Ablehnung ohne Begruendung belegt nur, DASS abgelehnt wurde, nicht
  // WORUEBER aufgeklaert wurde - und genau darauf kommt es im Streitfall an
  // (docs/08-textbausteine.md). Deshalb ist die Protokollnotiz hier Pflicht.
  const declineNeedsReason =
    topic.outcome === 'CLIENT_DECLINED' && (shared?.body ?? '').trim().length === 0;

  function saveNote(existing: NoteState | undefined, visibility: 'SHARED' | 'INTERNAL', body: string) {
    onCommand({
      type: 'NOTE_UPSERT',
      noteId: existing?.id ?? crypto.randomUUID(),
      topicId: topic.topicId,
      visibility,
      body,
    });
  }

  return (
    <div className="grid gap-7">
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2.5 text-2xl">
          <span className="flex size-10 items-center justify-center rounded-lg bg-surface-sunken text-ink-muted">
            <TopicIcon name={topic.icon} className="size-5" />
          </span>
          {name}
        </h2>
        {topic.isRequired ? (
          <p className="text-[0.8125rem] text-ink-subtle">
            Pflichtthema — braucht ein Ergebnis, bevor die Beratung abgeschlossen werden kann.
          </p>
        ) : null}
      </div>

      <fieldset className="grid gap-2.5">
        <legend className="mb-1 text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
          Bestehende Situation
        </legend>
        <div role="radiogroup" aria-label="Bestehende Situation" className="grid gap-2 sm:grid-cols-3">
          {COVERAGE_STATES.map((s) => (
            <Choice key={s} checked={topic.coverageState === s}
                    onClick={() => onCommand({ type: 'TOPIC_SET_COVERAGE', topicId: topic.topicId, coverageState: s })}>
              {COVERAGE_LABEL[s]}
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2.5">
        <legend className="mb-1 text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
          Entscheidung des Kunden
        </legend>
        <div role="radiogroup" aria-label="Entscheidung des Kunden" className="grid gap-2 sm:grid-cols-2">
          {OUTCOMES.map((o) => (
            <Choice key={o} checked={topic.outcome === o} color={OUTCOME_COLOR[o]}
                    onClick={() => onCommand({
                      type: 'TOPIC_SET_OUTCOME',
                      topicId: topic.topicId,
                      outcome: topic.outcome === o ? null : o,
                    })}>
              {OUTCOME_LABEL[o]}
            </Choice>
          ))}
        </div>
        {topic.outcome === 'CLIENT_DECLINED' ? (
          declineNeedsReason ? (
            <div role="alert"
                 className="rounded-md border border-warning/25 bg-warning-soft px-3.5 py-3 text-[0.8125rem] leading-relaxed text-warning">
              <p className="font-medium">Worauf haben Sie hingewiesen?</p>
              <p className="mt-0.5">
                Halten Sie unten im Protokollfeld fest, worüber Sie aufgeklärt haben. Eine
                Ablehnung ohne diesen Satz belegt nur, <em>dass</em> abgelehnt wurde — nicht
                worüber gesprochen wurde. Genau darauf kommt es im Streitfall an.
              </p>
            </div>
          ) : (
            <p className="text-[0.8125rem] leading-relaxed text-ink-muted">
              Die Ablehnung erscheint im Protokoll mit Ihrem Hinweis, dem Datum und dem Zusatz,
              dass die Entscheidung aus eigenem Antrieb erfolgte und jederzeit revidierbar ist.
            </p>
          )
        ) : null}
      </fieldset>

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor={`${noteId}-shared`}
                 className="flex items-center gap-1.5 text-[0.8125rem] font-medium">
            <Users aria-hidden className="size-3.5 text-ink-subtle" />
            {topic.outcome === 'CLIENT_DECLINED' ? 'Worauf Sie hingewiesen haben' : 'Notiz fürs Protokoll'}
            {topic.outcome === 'CLIENT_DECLINED' ? (
              <span className="text-danger" aria-hidden>*</span>
            ) : null}
          </label>
          <textarea
            id={`${noteId}-shared`}
            defaultValue={shared?.body ?? ''}
            onBlur={(e) => saveNote(shared, 'SHARED', e.target.value)}
            rows={3}
            aria-invalid={declineNeedsReason}
            placeholder={topic.outcome === 'CLIENT_DECLINED'
              ? 'im Todesfall keine private Absicherung besteht'
              : 'Kunde möchte höhere Deckung für Fahrräder und elektronische Geräte.'}
            className={`w-full rounded-lg border bg-surface px-3.5 py-2.5 text-[0.9375rem] leading-relaxed focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]/25 ${
              declineNeedsReason ? 'border-warning' : 'border-line-strong'}`}
          />
          <p className="text-[0.8125rem] text-ink-subtle">
            {topic.outcome === 'CLIENT_DECLINED'
              ? 'Wird zum Satz: „… wurde darauf hingewiesen, dass …"'
              : 'Erscheint im Protokoll für den Kunden.'}
          </p>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor={`${noteId}-internal`}
                 className="flex items-center gap-1.5 text-[0.8125rem] font-medium">
            <EyeOff aria-hidden className="size-3.5 text-ink-subtle" />
            Interne Notiz
          </label>
          <textarea
            id={`${noteId}-internal`}
            defaultValue={internal?.body ?? ''}
            onBlur={(e) => saveNote(internal, 'INTERNAL', e.target.value)}
            rows={2}
            placeholder="Nur für Sie — erscheint nie beim Kunden."
            className="w-full rounded-lg border border-dashed border-line-strong bg-surface-sunken px-3.5 py-2.5 text-[0.9375rem] leading-relaxed focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]/25"
          />
          <p className="text-[0.8125rem] text-ink-subtle">
            Erscheint nie im Kundenprotokoll und nie in der E-Mail.
          </p>
        </div>
      </div>
    </div>
  );
}

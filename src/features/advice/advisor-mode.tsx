'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, LayoutGrid, List, X } from 'lucide-react';
import { AdviceWheel, type WheelSegment } from '@/components/charts/advice-wheel';
import { Alert, Button } from '@/components/ui';
import { DISPLAY_STATE_META, toDisplayState } from '@/domain/advice/topic-status';
import type { SessionState } from '@/domain/advice/session-state';
import { useAdviceSession } from './use-advice-session';
import { SyncIndicator } from './components/sync-indicator';
import { TopicDetail } from './components/topic-detail';
import { TopicList } from './components/topic-list';

/**
 * Der Beratungsmodus (Konzeptpunkt 25).
 *
 * Genau drei Ansichten: Uebersicht (Rad oder Liste), eine Sparte, und
 * spaeter der Abschluss. Jede weitere Ebene macht die Bedienung im
 * Gespraech unsicher.
 */
export function AdvisorMode({
  sessionId, customerName, participants, initialState, topicNames,
}: {
  sessionId: string;
  customerName: string;
  participants: readonly string[];
  initialState: SessionState;
  topicNames: Readonly<Record<string, string>>;
}) {
  const { state, topics, progress, sync, dispatch } = useAdviceSession(sessionId, initialState);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overview, setOverview] = useState<'wheel' | 'list'>('wheel');

  const ordered = useMemo(
    () => [...topics].sort((a, b) => a.displayOrder - b.displayOrder),
    [topics],
  );

  const segments: WheelSegment[] = useMemo(
    () => ordered.map((t) => {
      const meta = DISPLAY_STATE_META[toDisplayState(t.progressStatus, t.outcome)];
      return {
        id: t.topicId,
        label: topicNames[t.topicId] ?? t.topicId,
        color: meta.color,
        icon: meta.icon,
        topicIcon: t.icon,
        statusLabel: meta.label,
        isRequired: t.isRequired,
      };
    }),
    [ordered, topicNames],
  );

  const notes = useMemo(() => Object.values(state.notes), [state.notes]);

  const activeIndex = ordered.findIndex((t) => t.topicId === activeId);
  const active = activeIndex >= 0 ? ordered[activeIndex] : null;

  function step(delta: number): void {
    if (activeIndex < 0) return;
    const next = ordered[activeIndex + delta];
    setActiveId(next ? next.topicId : null);
  }

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr_auto]">
      <header className="safe-top safe-x sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[1.0625rem] font-semibold">{customerName}</p>
            {participants.length > 0 ? (
              <p className="truncate text-[0.8125rem] text-ink-muted">
                {participants.join(', ')}
              </p>
            ) : null}
          </div>

          <SyncIndicator status={sync} className="hidden sm:flex" />

          <span className="tabular rounded-md bg-surface-sunken px-2.5 py-1 text-[0.8125rem] font-medium">
            {progress.settled}/{progress.total}
          </span>

          <Button asChild variant="ghost" size="icon" data-compact aria-label="Beratung verlassen">
            <Link href="/beratungen"><X aria-hidden /></Link>
          </Button>
        </div>

        <div className="h-0.5 bg-surface-sunken">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${progress.percent}%` }}
            role="progressbar"
            aria-valuenow={progress.settled}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label="Beratungsfortschritt"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-5">
        {sync.kind === 'conflict' ? (
          <Alert tone="danger" title={
            sync.reason === 'SESSION_CLOSED'
              ? 'Diese Beratung ist bereits abgeschlossen'
              : 'Diese Beratung ist auf einem anderen Gerät geöffnet'
          } className="mb-5">
            {sync.reason === 'SESSION_CLOSED'
              ? 'Weitere Änderungen sind nicht mehr möglich.'
              : 'Um Doppelerfassungen zu vermeiden, schreibt nur ein Gerät. Schliessen Sie die Beratung dort, oder laden Sie diese Seite neu, um zu übernehmen.'}
          </Alert>
        ) : null}

        {active ? (
          // Der Schluessel erzwingt beim Spartenwechsel ein frisches
          // Formular. Ohne ihn behielten die Notizfelder - sie arbeiten mit
          // defaultValue - den Text der zuvor geoeffneten Sparte.
          <TopicDetail
            key={active.topicId}
            topic={active}
            name={topicNames[active.topicId] ?? active.topicId}
            notes={notes}
            onCommand={dispatch}
          />
        ) : (
          <div className="grid gap-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl">Beratungsübersicht</h1>
                {progress.requiredOpen > 0 ? (
                  <p className="text-[0.8125rem] text-ink-muted">
                    Noch {progress.requiredOpen}{' '}
                    {progress.requiredOpen === 1 ? 'Pflichtthema' : 'Pflichtthemen'} offen
                  </p>
                ) : (
                  <p className="text-[0.8125rem] text-success">Alle Pflichtthemen erledigt</p>
                )}
              </div>

              {/* Rad und Liste sind gleichwertig: das Rad zeigt man dem
                  Kunden, gearbeitet wird meist in der Liste. */}
              <div role="radiogroup" aria-label="Ansicht"
                   className="flex gap-0.5 rounded-md border border-line bg-surface-sunken p-0.5">
                {([['wheel', LayoutGrid, 'Rad'], ['list', List, 'Liste']] as const).map(
                  ([value, Icon, label]) => (
                    <button
                      key={value} type="button" role="radio" data-compact
                      aria-checked={overview === value} aria-label={label} title={label}
                      onClick={() => setOverview(value)}
                      className={`flex size-8 items-center justify-center rounded-[0.25rem] ${
                        overview === value ? 'bg-surface text-ink' : 'text-ink-subtle'
                      }`}
                    >
                      <Icon aria-hidden className="size-4" />
                    </button>
                  ),
                )}
              </div>
            </div>

            {progress.requiredOpen === 0 && progress.total > 0 ? (
              // Erst wenn alles ein Ergebnis hat, wird der Abschluss zur
              // Hauptsache. Vorher stuende hier eine Schaltflaeche, die nur
              // zu einer Sperrmeldung fuehrt.
              <Button asChild size="lg" className="w-full">
                <Link href={`/beratung/${sessionId}/abschluss`}>
                  Beratung abschliessen<ChevronRight aria-hidden />
                </Link>
              </Button>
            ) : null}

            {overview === 'wheel' ? (
              // Das Rad fuellt die verbleibende Hoehe und sitzt mittig: es ist
              // das Element, das der Kunde ansieht.
              <div className="flex min-h-[min(58vh,520px)] items-center justify-center">
                <AdviceWheel
                  segments={segments}
                  settled={progress.settled}
                  onSelect={setActiveId}
                />
              </div>
            ) : (
              <TopicList topics={ordered} names={topicNames} onSelect={setActiveId} />
            )}
          </div>
        )}
      </main>

      <footer className="safe-bottom safe-x sticky bottom-0 border-t border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-5">
          <Button variant="ghost" onClick={() => step(-1)} disabled={activeIndex <= 0}>
            <ChevronLeft aria-hidden />Zurück
          </Button>

          <Button variant={active ? 'secondary' : 'ghost'} onClick={() => setActiveId(null)}>
            Beratungsrad
          </Button>

          {activeIndex >= 0 && activeIndex < ordered.length - 1 ? (
            <Button onClick={() => step(1)}>Weiter<ChevronRight aria-hidden /></Button>
          ) : activeIndex === ordered.length - 1 ? (
            <Button onClick={() => setActiveId(null)}>Übersicht<ChevronRight aria-hidden /></Button>
          ) : (
            <Button
              onClick={() => setActiveId(ordered[0]?.topicId ?? null)}
              disabled={ordered.length === 0}
            >
              {progress.settled === 0 ? 'Beratung beginnen' : 'Fortsetzen'}
              <ChevronRight aria-hidden />
            </Button>
          )}
        </div>

        <div className="mx-auto flex max-w-4xl justify-center pb-2 sm:hidden">
          <SyncIndicator status={sync} />
        </div>
      </footer>
    </div>
  );
}

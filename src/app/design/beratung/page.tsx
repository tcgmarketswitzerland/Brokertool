import type { Metadata } from 'next';
import type { SessionState } from '@/domain/advice/session-state';
import { AdvisorMode } from '@/features/advice/advisor-mode';

export const metadata: Metadata = { title: 'Beratungsmodus — Vorschau' };

/**
 * Vorschau des Beratungsmodus mit Beispieldaten, ohne Anmeldung.
 *
 * Zweck: das Erscheinungsbild auf dem echten Geraet pruefen, bevor es
 * Daten gibt. Bewusst als Teil der Designreferenz und nicht in der
 * Anwendung - die Daten hier sind erfunden und duerfen nirgends anders
 * auftauchen.
 */

const TOPICS: ReadonlyArray<[string, string, boolean, SessionState['topics'][string]['progressStatus'],
  SessionState['topics'][string]['outcome'], SessionState['topics'][string]['coverageState']]> = [
  ['a1', 'Hausrat',                 true,  'DISCUSSED',   'OFFER_REQUESTED',    'COVER_EXISTS'],
  ['a2', 'Privathaftpflicht',       true,  'DISCUSSED',   'NO_ACTION_NEEDED',   'COVER_EXISTS'],
  ['a3', 'Gebäude',                 false, 'SKIPPED',     null,                 'UNKNOWN'],
  ['a4', 'Motorfahrzeuge',          false, 'DISCUSSED',   'ACTION_REQUIRED',    'COVER_EXISTS'],
  ['a5', 'Rechtsschutz',            false, 'DISCUSSED',   'FOLLOW_UP',          'NO_COVER'],
  ['a6', 'Reise',                   false, 'DISCUSSED',   'NO_ACTION_NEEDED',   'COVER_EXISTS'],
  ['a7', 'Cyber',                   false, 'IN_PROGRESS', null,                 'NO_COVER'],
  ['a8', 'Haustiere',               false, 'NOT_STARTED', null,                 'UNKNOWN'],
  ['a9', 'Krankenkasse',            true,  'DISCUSSED',   'NO_ACTION_NEEDED',   'COVER_EXISTS'],
  ['b1', 'Unfall',                  false, 'DISCUSSED',   'NO_ACTION_NEEDED',   'COVER_EXISTS'],
  ['b2', 'Erwerbsunfähigkeit',      true,  'DISCUSSED',   'CLIENT_DECLINED',    'NO_COVER'],
  ['b3', 'Todesfall',               false, 'NOT_STARTED', null,                 'UNKNOWN'],
  ['b4', 'Vorsorge und Pensionierung', true, 'IN_PROGRESS', null,               'UNKNOWN'],
  ['b5', 'Säule 3a',                false, 'NOT_STARTED', null,                 'UNKNOWN'],
  ['b6', 'Hypothek und Wohneigentum', false, 'NOT_STARTED', null,               'UNKNOWN'],
];

export default function AdvisorPreviewPage() {
  const state: SessionState = {
    topics: Object.fromEntries(TOPICS.map(([id, , isRequired, progressStatus, outcome, coverageState], i) => [
      id,
      { topicId: id, isRequired, displayOrder: (i + 1) * 10, progressStatus, outcome, coverageState, priority: null },
    ])),
    notes: {},
  };

  return (
    <div data-density="advisor">
      <AdvisorMode
        sessionId="00000000-0000-4000-8000-000000000000"
        customerName="Max und Anna Muster"
        participants={['Max Muster', 'Anna Muster']}
        initialState={state}
        topicNames={Object.fromEntries(TOPICS.map(([id, name]) => [id, name]))}
      />
    </div>
  );
}

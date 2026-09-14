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

type Row = [string, string, string, boolean,
  SessionState['topics'][string]['progressStatus'],
  SessionState['topics'][string]['outcome'],
  SessionState['topics'][string]['coverageState']];

const TOPICS: ReadonlyArray<Row> = [
  ['a1', 'Hausratversicherung',       'sofa',        true,  'DISCUSSED',   'OFFER_REQUESTED',  'COVER_EXISTS'],
  ['a2', 'Privathaftpflicht',         'shield',      true,  'DISCUSSED',   'NO_ACTION_NEEDED', 'COVER_EXISTS'],
  ['a3', 'Gebäude',                   'building',    false, 'SKIPPED',     null,               'UNKNOWN'],
  ['a4', 'Motorfahrzeugversicherung', 'car',         false, 'DISCUSSED',   'ACTION_REQUIRED',  'COVER_EXISTS'],
  ['a5', 'Rechtsschutz',              'scale',       false, 'DISCUSSED',   'FOLLOW_UP',        'NO_COVER'],
  ['a6', 'Reise',                     'plane',       false, 'DISCUSSED',   'NO_ACTION_NEEDED', 'COVER_EXISTS'],
  ['a7', 'Cyber',                     'laptop',      false, 'IN_PROGRESS', null,               'NO_COVER'],
  ['a8', 'Krankenkasse',              'heart-pulse', true,  'DISCUSSED',   'NO_ACTION_NEEDED', 'COVER_EXISTS'],
  ['a9', 'Risiko',                    'umbrella',    true,  'DISCUSSED',   'CLIENT_DECLINED',  'NO_COVER'],
  ['b1', 'Vorsorge',                  'piggy-bank',  true,  'IN_PROGRESS', null,               'UNKNOWN'],
  ['b2', 'Hypothek',                  'key-round',   false, 'NOT_STARTED', null,               'UNKNOWN'],
];

export default function AdvisorPreviewPage() {
  const state: SessionState = {
    topics: Object.fromEntries(TOPICS.map(([id, , icon, isRequired, progressStatus, outcome, coverageState], i) => [
      id,
      { topicId: id, icon, isRequired, displayOrder: (i + 1) * 10, progressStatus, outcome, coverageState, priority: null },
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

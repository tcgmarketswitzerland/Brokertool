import type { Metadata } from 'next';
import type { SummaryDocument, SummaryTopic } from '@/domain/advice/summary';
import { suggestTasks } from '@/domain/task/suggestions';
import { CompletionView } from '@/features/advice/completion/completion-view';

export const metadata: Metadata = { title: 'Abschluss — Vorschau' };

/**
 * Vorschau des Abschlusses mit Beispieldaten, ohne Anmeldung.
 *
 * Wie bei /design/beratung: hier laesst sich auf dem echten Geraet
 * pruefen, ob sich das Unterschriftenfeld mit dem Finger bedienen laesst -
 * das sagt kein Bildschirm am Notebook. Die Daten sind erfunden.
 */

type Row = [string, string, string, SummaryTopic['outcome'], string, boolean, string | null];

const TOPICS: ReadonlyArray<Row> = [
  ['hausrat', 'Hausratversicherung', 'sofa', 'OFFER_REQUESTED', 'Offerte gewünscht', false,
    'Kunde möchte höhere Deckung für Fahrräder und elektronische Geräte.'],
  ['privathaftpflicht', 'Privathaftpflicht', 'shield', 'NO_ACTION_NEEDED', 'Kein Handlungsbedarf',
    false, 'Deckung geprüft und ausreichend.'],
  ['gebaeude', 'Gebäudeversicherung', 'building', null, 'Nicht behandelt', true, null],
  ['motorfahrzeug', 'Motorfahrzeugversicherung', 'car', 'CONTRACT_REQUESTED',
    'Abschluss gewünscht', false, 'Wechsel per 31.12. gewünscht.'],
  ['rechtsschutz', 'Rechtsschutz', 'scale', 'FOLLOW_UP', 'Später anschauen', false, null],
  ['reise', 'Reiseversicherung', 'plane', 'NO_ACTION_NEEDED', 'Kein Handlungsbedarf', false, null],
  ['cyber', 'Cyberversicherung', 'laptop', 'NO_ACTION_NEEDED', 'Kein Handlungsbedarf', false, null],
  ['krankenkasse', 'Krankenkasse', 'heart-pulse', 'ACTION_REQUIRED', 'Handlungsbedarf', false,
    'Franchise passt nicht mehr zur Situation.'],
  ['risiko', 'Risiko', 'umbrella', 'CLIENT_DECLINED', 'Kunde lehnt ab', false,
    'im Todesfall keine private Absicherung besteht'],
  ['vorsorge', 'Vorsorge', 'piggy-bank', 'NO_ACTION_NEEDED', 'Kein Handlungsbedarf', false, null],
  ['hypothek', 'Hypothek', 'key-round', 'NO_ACTION_NEEDED', 'Kein Handlungsbedarf', false, null],
];

export default function CompletionPreviewPage() {
  const topics: SummaryTopic[] = TOPICS.map(
    ([slug, name, icon, outcome, outcomeLabel, wasSkipped, note]) => ({
      slug, name, icon, outcome, outcomeLabel, wasSkipped,
      coverageState: 'COVER_EXISTS',
      existingPolicies: slug === 'hausrat'
        ? [{ insurerName: 'AXA', productName: null, annualPremiumCents: 48_000 }]
        : [],
      note,
    }),
  );

  const document: SummaryDocument = {
    schemaVersion: 1,
    sessionId: '00000000-0000-4000-8000-000000000000',
    date: '2026-09-15',
    customerName: 'Max und Anna Muster',
    participants: ['Max Muster', 'Anna Muster'],
    advisorName: 'Peter Muster',
    organizationName: 'Muster Broker AG',
    location: null,
    counts: {
      total: topics.length,
      discussed: topics.filter((t) => !t.wasSkipped && t.outcome !== null).length,
      actionNeeded: 3,
      declined: 1,
      noAction: 6,
      skipped: 1,
    },
    topics,
    customerTasks: [],
    advisorTasks: [],
    totalAnnualPremiumCents: 48_000,
    pension: null,
  };

  const suggestions = suggestTasks(topics.map((t, i) => ({
    topicId: t.slug,
    name: t.name,
    displayOrder: (i + 1) * 10,
    outcome: t.outcome,
    progressStatus: t.wasSkipped ? 'SKIPPED' : t.outcome === null ? 'NOT_STARTED' : 'DISCUSSED',
  })));

  return (
    <CompletionView
      sessionId="00000000-0000-4000-8000-000000000000"
      document={document}
      suggestions={suggestions}
      untouched={['Gebäudeversicherung']}
      blocked={false}
    />
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { COVERAGE_LABEL, OUTCOME_LABEL } from '@/domain/advice/status';
import { computeProgress } from '@/domain/advice/progress';
import { getSession } from '@/features/advice/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Beratung' };

/**
 * Ansicht einer Beratung ausserhalb des Beratungsmodus. Die vollstaendige
 * Zusammenfassung mit Abschluss, Unterschrift und PDF entsteht in Phase 6
 * und 7; hier steht vorerst der Stand.
 */
export default async function SessionSummaryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) notFound();

  const progress = computeProgress(session.topics.map((t) => ({
    topicId: t.topicId, isRequired: t.isRequired,
    progressStatus: t.progressStatus, outcome: t.outcome,
  })));

  // Interne Notizen erscheinen hier nicht. Die Filterung passiert spaeter an
  // genau einer Stelle im SummaryDocument (Architektur 10.3) - bis dahin
  // ausdruecklich auch hier.
  const sharedNotes = session.notes.filter((n) => n.visibility === 'SHARED');

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Link href="/beratungen"
              className="flex w-fit items-center gap-1.5 rounded-sm text-[0.8125rem] text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-3.5" />Beratungen
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl">{session.customerName}</h1>
            <p className="tabular text-sm text-ink-muted">
              {session.startedAt
                ? new Date(session.startedAt).toLocaleDateString('de-CH', {
                    day: '2-digit', month: 'long', year: 'numeric' })
                : 'Nicht gestartet'}
              {session.advisorName ? ` · ${session.advisorName}` : ''}
            </p>
          </div>
          <Badge tone={session.status === 'COMPLETED' ? 'success' : 'accent'}>
            {session.status === 'COMPLETED' ? 'Abgeschlossen' : 'Läuft'}
          </Badge>
        </div>
      </div>

      {session.status !== 'COMPLETED' ? (
        <Alert tone="info" title="Beratung läuft noch">
          {progress.requiredOpen > 0
            ? `Noch ${progress.requiredOpen} Pflichtthemen offen. Abschluss, Unterschrift und PDF entstehen in Phase 6 und 7.`
            : 'Alle Pflichtthemen erledigt. Abschluss, Unterschrift und PDF entstehen in Phase 6 und 7.'}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Erledigt', `${progress.settled}/${progress.total}`],
          ['Handlungsbedarf', String(progress.actionNeeded)],
          ['Abgelehnt', String(progress.declined)],
          ['Pflicht offen', String(progress.requiredOpen)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="grid gap-1">
              <p className="text-[0.8125rem] text-ink-muted">{label}</p>
              <p className="tabular text-xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Besprochene Bereiche</CardTitle></CardHeader>
        <ul className="divide-y divide-line">
          {session.topics.map((topic) => {
            const notes = sharedNotes.filter((n) => n.sessionTopicId === topic.id);
            return (
              <li key={topic.id} className="grid gap-1.5 px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{topic.name}</p>
                  {topic.outcome ? (
                    <Badge tone={topic.outcome === 'NO_ACTION_NEEDED' ? 'success' : 'accent'}>
                      {OUTCOME_LABEL[topic.outcome]}
                    </Badge>
                  ) : (
                    <Badge>
                      {topic.progressStatus === 'SKIPPED' ? 'Übersprungen' : 'Offen'}
                    </Badge>
                  )}
                </div>
                {topic.coverageState !== 'UNKNOWN' ? (
                  <p className="text-[0.8125rem] text-ink-muted">
                    {COVERAGE_LABEL[topic.coverageState]}
                  </p>
                ) : null}
                {notes.map((n) => (
                  <p key={n.id} className="text-[0.8125rem] leading-relaxed text-ink-muted">
                    {n.body}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

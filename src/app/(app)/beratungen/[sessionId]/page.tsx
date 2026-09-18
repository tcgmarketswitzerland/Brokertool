import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, Download, Mail, PenLine, PiggyBank, ShieldCheck,
} from 'lucide-react';
import {
  Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, TopicIcon,
} from '@/components/ui';
import { COVERAGE_LABEL, OUTCOME_LABEL } from '@/domain/advice/status';
import { computeProgress } from '@/domain/advice/progress';
import { formatCHF, rappen } from '@/domain/shared/money';
import { formatShortDate, topicNarrative } from '@/domain/advice/protocol';
import { getSession } from '@/features/advice/queries';
import { getSignature, getSnapshot } from '@/features/protocol/queries';
import { EmailDraft } from '@/features/protocol/email-draft';
import { listSessionTasks } from '@/features/tasks/queries';
import { TaskRow } from '@/features/tasks/components/task-row';
import { formatDateLong } from '@/domain/shared/date';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Beratung' };

/**
 * Ansicht einer Beratung ausserhalb des Beratungsmodus.
 *
 * Ist die Beratung abgeschlossen, zeigt die Seite den eingefrorenen
 * Snapshot - nicht den aktuellen Datenbankstand. Das ist der ganze Sinn
 * des Snapshots: wer das Protokoll in fuenf Jahren aufruft, sieht das
 * Gespraech von damals und nicht die Vertraege von heute.
 */
export default async function SessionSummaryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) notFound();

  const [snapshot, signature, tasks] = await Promise.all([
    session.status === 'COMPLETED' ? getSnapshot(sessionId) : Promise.resolve(null),
    session.status === 'COMPLETED' ? getSignature(sessionId) : Promise.resolve(null),
    listSessionTasks(sessionId),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  const progress = computeProgress(session.topics.map((t) => ({
    topicId: t.topicId, isRequired: t.isRequired,
    progressStatus: t.progressStatus, outcome: t.outcome,
  })));

  // Interne Notizen erscheinen hier nie. Bei einer abgeschlossenen Beratung
  // ist die Filterung bereits im Snapshot passiert (Architektur 10.3), bei
  // einer laufenden hier - ausdruecklich, nicht nebenbei.
  const sharedNotes = session.notes.filter((n) => n.visibility === 'SHARED');
  const document = snapshot?.document ?? null;

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
                ? formatDateLong(session.startedAt)
                : 'Nicht gestartet'}
              {session.advisorName ? ` · ${session.advisorName}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={session.status === 'COMPLETED' ? 'success' : 'accent'}>
              {session.status === 'COMPLETED' ? 'Abgeschlossen' : 'Läuft'}
            </Badge>
            {snapshot ? (
              <Button asChild>
                <a href={`/beratungen/${sessionId}/protokoll.pdf`} target="_blank" rel="noreferrer">
                  <Download aria-hidden />Protokoll (PDF)
                </a>
              </Button>
            ) : (
              <Button asChild variant={progress.requiredOpen === 0 ? 'primary' : 'secondary'}>
                <Link href={`/beratung/${sessionId}`}>
                  {progress.settled === 0 ? 'Beratung beginnen' : 'Beratung fortsetzen'}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {session.status !== 'COMPLETED' ? (
        <Alert tone="info" title="Beratung läuft noch">
          {progress.requiredOpen > 0
            ? `Noch ${progress.requiredOpen} Pflichtsparten ohne Ergebnis. Erst wenn jede Sparte ein Ergebnis hat, lässt sich die Beratung abschliessen.`
            : 'Alle Pflichtsparten haben ein Ergebnis. Die Beratung lässt sich abschliessen.'}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {(document
          ? [
              ['Besprochen', `${document.counts.discussed}/${document.counts.total}`],
              ['Handlungsbedarf', String(document.counts.actionNeeded)],
              ['Abgelehnt', String(document.counts.declined)],
              ['Nicht behandelt', String(document.counts.skipped)],
            ]
          : [
              ['Erledigt', `${progress.settled}/${progress.total}`],
              ['Handlungsbedarf', String(progress.actionNeeded)],
              ['Abgelehnt', String(progress.declined)],
              ['Pflicht offen', String(progress.requiredOpen)],
            ]
        ).map(([label, value]) => (
          <Card key={label}>
            <CardContent className="grid gap-1">
              <p className="text-[0.8125rem] text-ink-muted">{label}</p>
              <p className="tabular text-xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {tasks.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Folgeaufgaben aus diesem Gespräch</CardTitle></CardHeader>
          <ul className="divide-y divide-line">
            {tasks.map((t) => <TaskRow key={t.id} task={t} today={today} showCustomer={false} />)}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Besprochene Sparten</CardTitle></CardHeader>
        <ul className="divide-y divide-line">
          {document
            ? document.topics.map((topic) => {
                const narrative = topicNarrative(topic, document);
                return (
                  <li key={topic.slug} className="grid gap-1.5 px-5 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium">
                        <TopicIcon name={topic.icon} className="size-4 text-ink-muted" />
                        {topic.name}
                      </span>
                      <Badge tone={
                        topic.outcome === 'NO_ACTION_NEEDED' ? 'success'
                          : topic.outcome === 'CLIENT_DECLINED' ? 'warning'
                            : topic.wasSkipped || topic.outcome === null ? 'neutral' : 'accent'
                      }>
                        {topic.outcomeLabel}
                      </Badge>
                    </div>
                    {topic.existingPolicies.map((p, i) => (
                      <p key={`${p.insurerName}-${i}`} className="tabular text-[0.8125rem] text-ink-subtle">
                        Bestehende Lösung: {p.insurerName}
                        {p.annualPremiumCents
                          ? `, ${formatCHF(rappen(p.annualPremiumCents))} im Jahr` : ''}
                      </p>
                    ))}
                    {narrative ? (
                      <p className="whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-muted">
                        {narrative}
                      </p>
                    ) : null}
                  </li>
                );
              })
            : session.topics.map((topic) => {
                const notes = sharedNotes.filter((n) => n.sessionTopicId === topic.id);
                return (
                  <li key={topic.id} className="grid gap-1.5 px-5 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium">
                        <TopicIcon name={topic.icon} className="size-4 text-ink-muted" />
                        {topic.name}
                      </span>
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

      {document?.pension ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank aria-hidden className="size-4 text-ink-subtle" />
              Vorsorgeanalyse
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-sunken text-left">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Fall</th>
                  <th className="px-5 py-2.5 text-right font-medium">Einkommen im Jahr</th>
                  <th className="px-5 py-2.5 text-right font-medium">Lücke</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line">
                {document.pension.cases.map((c) => (
                  <tr key={c.pensionCase}>
                    <td className="px-5 py-2.5">{c.label}</td>
                    <td className="px-5 py-2.5 text-right">
                      {formatCHF(rappen(c.totalCents))}
                      {c.coveragePercent !== null ? (
                        <span className="ml-1.5 text-ink-muted">{c.coveragePercent}%</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {c.gapCents === null ? '—'
                        : c.gapCents > 0
                          ? <span className="text-danger">{formatCHF(rappen(c.gapCents))}</span>
                          : <span className="text-success">gedeckt</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {document ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail aria-hidden className="size-4 text-ink-subtle" />
              E-Mail an den Kunden
            </CardTitle>
          </CardHeader>
          <EmailDraft document={document} />
        </Card>
      ) : null}

      {snapshot ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[0.8125rem] text-ink-subtle">
            <span className="flex items-center gap-1.5">
              <ShieldCheck aria-hidden className="size-3.5 text-success" />
              Eingefroren am {formatShortDate(snapshot.createdAt.slice(0, 10))}
            </span>
            <span className="tabular">Dokumentkennung {snapshot.contentHash.slice(0, 12)}</span>
            {signature ? (
              <span className="flex items-center gap-1.5">
                <PenLine aria-hidden className="size-3.5" />
                Unterschrieben von {signature.signerName} am{' '}
                {formatShortDate(signature.signedAt.slice(0, 10))}
              </span>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

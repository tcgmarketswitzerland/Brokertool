import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { canCompleteSession } from '@/domain/advice/completion';
import { getCompletionData } from '@/features/advice/completion/queries';
import { CompletionView } from '@/features/advice/completion/completion-view';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Beratung abschliessen' };

export default async function CompletionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await getCompletionData(sessionId);
  if (!data) notFound();
  if (data.session.status === 'COMPLETED') redirect(`/beratungen/${sessionId}`);

  const check = canCompleteSession({
    status: data.session.status,
    topics: data.session.topics.map((t) => ({
      topicId: t.topicId, isRequired: t.isRequired,
      progressStatus: t.progressStatus, outcome: t.outcome,
    })),
  });

  // Die Namen der Sparten, die als "nicht thematisiert" ins Protokoll
  // gehen. Der Berater sieht damit vor dem Abschluss, was er festhaelt -
  // und kann zurueckspringen, wenn eine davon doch besprochen wurde.
  const untouched = data.session.topics
    .filter((t) => t.outcome === null)
    .map((t) => t.name);

  return (
    <CompletionView
      sessionId={sessionId}
      document={data.document}
      suggestions={data.suggestions}
      untouched={untouched}
      blocked={!check.ok}
    />
  );
}

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

  // Die Sperre nennt Namen, keine Kennungen: der Berater soll sehen, wohin
  // er zurueckspringen muss, nicht dass etwas fehlt.
  const blockers = check.ok || check.error.kind !== 'MISSING_REQUIRED'
    ? []
    : check.error.topics.map(
        (id) => data.session.topics.find((t) => t.topicId === id)?.name ?? id);

  return (
    <CompletionView
      sessionId={sessionId}
      document={data.document}
      suggestions={data.suggestions}
      blockers={blockers}
    />
  );
}

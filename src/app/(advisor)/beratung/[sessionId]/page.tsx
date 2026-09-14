import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { SessionState } from '@/domain/advice/session-state';
import { AdvisorMode } from '@/features/advice/advisor-mode';
import { getSession } from '@/features/advice/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Beratung' };

export default async function AdvisorPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) notFound();

  // Eine abgeschlossene Beratung ist unveraenderlich - sie gehoert in die
  // Zusammenfassung, nicht in den Bearbeitungsmodus (Konzeptpunkt 29).
  if (session.status === 'COMPLETED') redirect(`/beratungen/${sessionId}`);

  const initialState: SessionState = {
    topics: Object.fromEntries(session.topics.map((t) => [t.topicId, {
      topicId: t.topicId,
      isRequired: t.isRequired,
      displayOrder: t.displayOrder,
      progressStatus: t.progressStatus,
      outcome: t.outcome,
      coverageState: t.coverageState,
      priority: t.priority,
    }])),
    notes: Object.fromEntries(session.notes.map((n) => {
      const topic = session.topics.find((t) => t.id === n.sessionTopicId);
      return [n.id, {
        id: n.id,
        topicId: topic?.topicId ?? null,
        visibility: n.visibility,
        body: n.body,
      }];
    })),
  };

  const topicNames = Object.fromEntries(session.topics.map((t) => [t.topicId, t.name]));

  return (
    <AdvisorMode
      sessionId={session.id}
      customerName={session.customerName}
      participants={session.participants}
      initialState={initialState}
      topicNames={topicNames}
    />
  );
}

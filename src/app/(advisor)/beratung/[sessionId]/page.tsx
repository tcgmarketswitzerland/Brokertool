import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { SessionState } from '@/domain/advice/session-state';
import { AdvisorMode } from '@/features/advice/advisor-mode';
import { getSession } from '@/features/advice/queries';
import { getPensionAnalysis } from '@/features/pension/queries';
import { PensionAnalysis } from '@/features/pension/pension-analysis';
import { PremiumComparison } from '@/features/health/premium-comparison';
import { getCustomerHousehold } from '@/features/health/household';

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
      icon: t.icon,
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

  // Zwei Sparten bekommen mehr als die reine Spartenansicht. Geladen wird
  // das hier auf dem Server und als fertiger Baustein hineingereicht - der
  // Beratungsmodus selbst kennt keine Datenbank.
  const extras: Record<string, React.ReactNode> = {};

  const pensionTopic = session.topics.find((t) => t.slug === 'vorsorge');
  if (pensionTopic) {
    const stored = await getPensionAnalysis(sessionId);
    extras[pensionTopic.topicId] = (
      <PensionAnalysis
        session={{ sessionId, customerId: session.customerId }}
        initial={stored ? {
          income: stored.household.annualIncomeCents === null
            ? '' : String(stored.household.annualIncomeCents / 100),
          target: stored.household.targetPercent === null
            ? '' : String(stored.household.targetPercent),
          hasPartner: stored.household.hasPartner,
          partnerIncome: stored.household.partnerIncomeCents === null
            ? '' : String(stored.household.partnerIncomeCents / 100),
          children: String(stored.household.childCount),
          values: stored.values,
        } : undefined}
      />
    );
  }

  const healthTopic = session.topics.find((t) => t.slug === 'krankenkasse');
  if (healthTopic) {
    const household = await getCustomerHousehold(session.customerId);
    extras[healthTopic.topicId] = (
      <PremiumComparison
        postalCode={household.postalCode ?? undefined}
        persons={household.persons}
        currentPremiumCents={household.currentHealthPremiumCents}
      />
    );
  }

  return (
    <AdvisorMode
      sessionId={session.id}
      customerName={session.customerName}
      participants={session.participants}
      initialState={initialState}
      topicNames={topicNames}
      extras={extras}
    />
  );
}

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { annualPremiumCents } from '@/domain/policy/types';
import {
  buildSummary, type SummaryDocument, type SummaryInput, type SummaryInputTask,
} from '@/domain/advice/summary';
import { suggestTasks, type SuggestedTask } from '@/domain/task/suggestions';
import { listPolicies } from '@/features/policies/queries';
import { getSession, type AdviceSession } from '@/features/advice/queries';

export type CompletionData = {
  session: AdviceSession;
  document: SummaryDocument;
  suggestions: readonly SuggestedTask[];
  /** Datum des Gespraechs als ISO-Tag - Grundlage aller Fristen. */
  sessionDate: string;
};

async function organizationName(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from('organizations').select('name').limit(1).maybeSingle();
  return data ? String(data.name) : '';
}

/**
 * Alles, was der Abschluss braucht - in einem Zug geladen.
 *
 * Das Dokument wird hier gebaut und beim Abschluss unveraendert
 * eingefroren. Berater sieht also vor der Unterschrift genau das, was
 * spaeter im Protokoll steht: eine Vorschau, die etwas anderes zeigt als
 * das Ergebnis, waere schlimmer als gar keine.
 */
export async function getCompletionData(
  sessionId: string,
  tasks: readonly SummaryInputTask[] = [],
): Promise<CompletionData | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const [policies, orgName] = await Promise.all([
    listPolicies(session.customerId), organizationName(),
  ]);

  const sessionDate = (session.startedAt ?? new Date().toISOString()).slice(0, 10);

  const input: SummaryInput = {
    sessionId: session.id,
    date: sessionDate,
    customerName: session.customerName,
    participants: session.participants,
    advisorName: session.advisorName,
    organizationName: orgName,
    location: null,
    topics: session.topics.map((t) => ({
      topicId: t.topicId,
      slug: t.slug,
      name: t.name,
      icon: t.icon,
      displayOrder: t.displayOrder,
      isRequired: t.isRequired,
      progressStatus: t.progressStatus,
      outcome: t.outcome,
      coverageState: t.coverageState,
    })),
    policies: policies.map((p) => ({
      topicId: p.topicId,
      insurerName: p.insurerName,
      productName: p.productName,
      annualPremiumCents: annualPremiumCents(p.premiumCents, p.premiumFrequency),
    })),
    notes: session.notes.map((n) => ({
      // Die Notiz haengt an der Sitzungssparte; das Dokument denkt in
      // Katalogsparten. Hier wird einmal umgeschluesselt.
      topicId: session.topics.find((t) => t.id === n.sessionTopicId)?.topicId ?? null,
      visibility: n.visibility,
      body: n.body,
    })),
    tasks,
  };

  return {
    session,
    document: buildSummary(input),
    suggestions: suggestTasks(session.topics.map((t) => ({
      topicId: t.topicId,
      name: t.name,
      displayOrder: t.displayOrder,
      outcome: t.outcome,
      progressStatus: t.progressStatus,
    }))),
    sessionDate,
  };
}

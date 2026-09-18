import 'server-only';
import { annualPremiumCents } from '@/domain/policy/types';
import {
  buildSummary, type SummaryDocument, type SummaryInput, type SummaryInputTask,
} from '@/domain/advice/summary';
import { settleUntouched } from '@/domain/advice/completion';
import { suggestTasks, type SuggestedTask } from '@/domain/task/suggestions';
import { listPolicies } from '@/features/policies/queries';
import { getSession, type AdviceSession } from '@/features/advice/queries';
import { getPensionForSummary } from '@/features/pension/queries';
import { getOrganizationContact } from '@/features/organization/queries';

export type CompletionData = {
  session: AdviceSession;
  document: SummaryDocument;
  suggestions: readonly SuggestedTask[];
  /** Datum des Gespraechs als ISO-Tag - Grundlage aller Fristen. */
  sessionDate: string;
};

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

  const [policies, organization, pension] = await Promise.all([
    listPolicies(session.customerId), getOrganizationContact(),
    getPensionForSummary(sessionId),
  ]);

  const sessionDate = (session.startedAt ?? new Date().toISOString()).slice(0, 10);

  const input: SummaryInput = {
    sessionId: session.id,
    date: sessionDate,
    customerName: session.customerName,
    participants: session.participants,
    advisorName: session.advisorName,
    organizationName: organization.name,
    // Die Firmenzeile wird mit eingefroren: zieht die Firma um, zeigt ein
    // Nachdruck weiterhin die Adresse, unter der beraten wurde.
    organization: {
      street: organization.street,
      postalCode: organization.postalCode,
      city: organization.city,
      phone: organization.phone,
      email: organization.email,
      website: organization.website,
    },
    location: null,
    // settleUntouched: dieselbe Regel, die der Abschluss in der Datenbank
    // anwendet (Migration 0022). Ohne sie zeigte die Vorschau "offen", wo
    // gleich "nicht thematisiert" stehen wird.
    topics: session.topics.map((t) => {
      const settled = settleUntouched({
        topicId: t.topicId,
        isRequired: t.isRequired,
        progressStatus: t.progressStatus,
        outcome: t.outcome,
      });
      return {
        topicId: t.topicId,
        slug: t.slug,
        name: t.name,
        icon: t.icon,
        displayOrder: t.displayOrder,
        isRequired: t.isRequired,
        progressStatus: settled.progressStatus,
        outcome: settled.outcome,
        coverageState: t.coverageState,
      };
    }),
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
    pension,
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

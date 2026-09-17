import type { CoverageState, Outcome, ProgressStatus } from './status';
import { OUTCOME_LABEL } from './status';
import type { PensionCase } from '@/domain/pension/types';

/**
 * Das SummaryDocument (Architektur 10.3).
 *
 * Einmal berechnet, dreifach gerendert: PDF, E-Mail, Export. Statt drei
 * Stellen, die dieselbe Zusammenfassung leicht unterschiedlich
 * zusammenbauen - und von denen eine irgendwann die Filterung interner
 * Notizen vergisst.
 *
 * Dasselbe Objekt wird beim Abschluss als Snapshot eingefroren. Es ist
 * damit die rechtlich massgebliche Fassung der Beratung und muss ohne
 * Zugriff auf andere Tabellen vollstaendig lesbar sein - deshalb sind
 * Namen ausgeschrieben und nicht als Verweise gespeichert.
 */

export const SUMMARY_SCHEMA_VERSION = 1;

export type SummaryInputTopic = {
  readonly topicId: string;
  readonly slug: string;
  readonly name: string;
  readonly icon: string | null;
  readonly displayOrder: number;
  readonly isRequired: boolean;
  readonly progressStatus: ProgressStatus;
  readonly outcome: Outcome | null;
  readonly coverageState: CoverageState;
};

export type SummaryInputPolicy = {
  readonly topicId: string;
  readonly insurerName: string;
  readonly productName: string | null;
  readonly annualPremiumCents: number | null;
};

export type SummaryInputNote = {
  readonly topicId: string | null;
  readonly visibility: 'INTERNAL' | 'SHARED';
  readonly body: string;
};

export type SummaryInputTask = {
  readonly ownerType: 'CUSTOMER' | 'ADVISOR';
  readonly title: string;
  readonly dueDate: string | null;
};

/**
 * Die Vorsorgeanalyse im Protokoll.
 *
 * Nicht die Eingabefelder, sondern das Ergebnis: was der Kunde in jedem
 * Fall haette, was er sich vorgenommen hat, und was fehlt. Die Eingaben
 * stehen in pension_analyses; hier steht, was beide angesehen haben.
 */
export type SummaryPensionCase = {
  readonly pensionCase: PensionCase;
  readonly label: string;
  readonly totalCents: number;
  readonly gapCents: number | null;
  readonly coveragePercent: number | null;
};

export type SummaryPension = {
  readonly annualIncomeCents: number | null;
  readonly targetPercent: number | null;
  readonly targetCents: number | null;
  readonly hasPartner: boolean;
  readonly childCount: number;
  readonly cases: readonly SummaryPensionCase[];
  /** Der Fall mit der groessten Luecke, als Satz fuer das Protokoll. */
  readonly largestGapLabel: string | null;
};

export type SummaryInput = {
  readonly sessionId: string;
  readonly date: string;
  readonly customerName: string;
  readonly participants: readonly string[];
  readonly advisorName: string;
  readonly organizationName: string;
  readonly location: string | null;
  readonly topics: readonly SummaryInputTopic[];
  readonly policies: readonly SummaryInputPolicy[];
  readonly notes: readonly SummaryInputNote[];
  readonly tasks: readonly SummaryInputTask[];
  readonly pension: SummaryPension | null;
};

export type SummaryTopic = {
  readonly slug: string;
  readonly name: string;
  readonly icon: string | null;
  readonly outcome: Outcome | null;
  readonly outcomeLabel: string;
  readonly coverageState: CoverageState;
  readonly wasSkipped: boolean;
  readonly existingPolicies: readonly {
    readonly insurerName: string;
    readonly productName: string | null;
    readonly annualPremiumCents: number | null;
  }[];
  readonly note: string | null;
};

export type SummaryDocument = {
  readonly schemaVersion: number;
  readonly sessionId: string;
  readonly date: string;
  readonly customerName: string;
  readonly participants: readonly string[];
  readonly advisorName: string;
  readonly organizationName: string;
  readonly location: string | null;
  readonly counts: {
    readonly total: number;
    readonly discussed: number;
    readonly actionNeeded: number;
    readonly declined: number;
    readonly noAction: number;
    readonly skipped: number;
  };
  readonly topics: readonly SummaryTopic[];
  readonly customerTasks: readonly { readonly title: string; readonly dueDate: string | null }[];
  readonly advisorTasks: readonly { readonly title: string; readonly dueDate: string | null }[];
  readonly totalAnnualPremiumCents: number;
  readonly pension: SummaryPension | null;
};

const ACTION_OUTCOMES: ReadonlySet<Outcome> = new Set<Outcome>([
  'ACTION_REQUIRED', 'OFFER_REQUESTED', 'CONTRACT_REQUESTED', 'FOLLOW_UP',
]);

/**
 * Baut das Protokolldokument.
 *
 * Die Filterung interner Notizen passiert hier und nur hier. Berater und
 * Kunde schauen im Gespraech auf denselben Bildschirm; eine interne Notiz
 * im Kunden-PDF ist ein Vorfall, der ein Konto kostet (Analyse 1.6).
 */
export function buildSummary(input: SummaryInput): SummaryDocument {
  const shared = input.notes.filter((n) => n.visibility === 'SHARED');

  const topics = [...input.topics]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((topic): SummaryTopic => {
      const policies = input.policies
        .filter((p) => p.topicId === topic.topicId)
        .map((p) => ({
          insurerName: p.insurerName,
          productName: p.productName,
          annualPremiumCents: p.annualPremiumCents,
        }));

      const note = shared.find((n) => n.topicId === topic.topicId)?.body.trim() ?? null;
      const wasSkipped = topic.progressStatus === 'SKIPPED';

      return {
        slug: topic.slug,
        name: topic.name,
        icon: topic.icon,
        outcome: topic.outcome,
        // Uebersprungen ist kein Ergebnis, sondern das Fehlen eines
        // Gespraechs. Das Protokoll sagt das so, statt es zu umschreiben -
        // eine Formulierung, die nach Beratung klingt, schadet dem Berater
        // mehr als die Wahrheit.
        outcomeLabel: wasSkipped
          ? 'Nicht thematisiert'
          : topic.outcome
            ? OUTCOME_LABEL[topic.outcome]
            : 'Offen',
        coverageState: topic.coverageState,
        wasSkipped,
        existingPolicies: policies,
        note: note && note.length > 0 ? note : null,
      };
    });

  const counts = {
    total: topics.length,
    discussed: topics.filter((t) => !t.wasSkipped && t.outcome !== null).length,
    actionNeeded: topics.filter((t) => t.outcome !== null && ACTION_OUTCOMES.has(t.outcome)).length,
    declined: topics.filter((t) => t.outcome === 'CLIENT_DECLINED').length,
    noAction: topics.filter((t) => t.outcome === 'NO_ACTION_NEEDED').length,
    skipped: topics.filter((t) => t.wasSkipped).length,
  };

  const task = (t: SummaryInputTask) => ({ title: t.title, dueDate: t.dueDate });

  return {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    sessionId: input.sessionId,
    date: input.date,
    customerName: input.customerName,
    participants: input.participants,
    advisorName: input.advisorName,
    organizationName: input.organizationName,
    location: input.location,
    counts,
    topics,
    customerTasks: input.tasks.filter((t) => t.ownerType === 'CUSTOMER').map(task),
    advisorTasks: input.tasks.filter((t) => t.ownerType === 'ADVISOR').map(task),
    totalAnnualPremiumCents: input.policies.reduce(
      (sum, p) => sum + (p.annualPremiumCents ?? 0), 0),
    pension: input.pension,
  };
}

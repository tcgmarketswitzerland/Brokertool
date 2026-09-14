import type { Outcome } from '@/domain/advice/status';
import type { TaskOwner, TaskPriority } from './types';

/**
 * Folgeaufgaben aus dem Gespraech ableiten.
 *
 * Das Kernversprechen des Produkts lautet, aus einem strukturierten
 * Gespraech "automatisch eine nachvollziehbare Beratungsdokumentation und
 * Folgeaufgaben" zu erzeugen. Automatisch heisst hier: der Berater tippt
 * im Gespraech keine Aufgaben, sondern bestaetigt beim Abschluss, was sich
 * aus den Ergebnissen ohnehin ergibt.
 *
 * Das ist zugleich der Grund, warum Aufgaben nicht ueber die
 * Befehlspipeline laufen: sie entstehen am Schluss, wenn die Verbindung
 * ohnehin gebraucht wird, nicht waehrend des Gespraechs.
 */

export type SuggestedTask = {
  readonly key: string;
  readonly topicId: string;
  readonly topicName: string;
  readonly ownerType: TaskOwner;
  readonly title: string;
  readonly priority: TaskPriority;
  /** Tage ab Gespraechsdatum. Null heisst: ohne Frist. */
  readonly dueInDays: number | null;
};

export type SuggestionInputTopic = {
  readonly topicId: string;
  readonly name: string;
  readonly displayOrder: number;
  readonly outcome: Outcome | null;
  readonly progressStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'DISCUSSED' | 'SKIPPED';
};

type Rule = {
  readonly ownerType: TaskOwner;
  readonly title: (topicName: string) => string;
  readonly priority: TaskPriority;
  readonly dueInDays: number | null;
};

/**
 * Je Ergebnis hoechstens zwei Aufgaben - eine fuer den Berater, eine fuer
 * den Kunden. Mehr Vorschlaege fuehren dazu, dass beim Abschluss alles
 * weggeklickt wird, und dann traegt die Liste nichts mehr.
 */
const RULES: Partial<Record<Outcome, readonly Rule[]>> = {
  OFFER_REQUESTED: [
    {
      ownerType: 'ADVISOR',
      title: (t) => `Offerte einholen: ${t}`,
      priority: 'HIGH',
      dueInDays: 7,
    },
  ],
  CONTRACT_REQUESTED: [
    {
      ownerType: 'ADVISOR',
      title: (t) => `Antrag erstellen: ${t}`,
      priority: 'HIGH',
      dueInDays: 5,
    },
    {
      ownerType: 'CUSTOMER',
      title: (t) => `Unterlagen zur ${t} bereitstellen`,
      priority: 'NORMAL',
      dueInDays: 10,
    },
  ],
  ACTION_REQUIRED: [
    {
      ownerType: 'ADVISOR',
      title: (t) => `Handlungsbedarf klären: ${t}`,
      priority: 'HIGH',
      dueInDays: 14,
    },
  ],
  FOLLOW_UP: [
    {
      ownerType: 'ADVISOR',
      title: (t) => `Thema wieder aufnehmen: ${t}`,
      priority: 'NORMAL',
      dueInDays: 90,
    },
  ],
  // Eine Ablehnung erzeugt bewusst KEINE Aufgabe. Sie ist im Protokoll
  // dokumentiert; eine Aufgabe daraus waere ein Nachfassen gegen den
  // ausdruecklichen Willen des Kunden.
};

/** Ein uebersprungenes Pflichtthema ist die einzige Luecke, die nachgeholt gehoert. */
const SKIPPED_RULE: Rule = {
  ownerType: 'ADVISOR',
  title: (t) => `Nicht behandelt: ${t} nachholen`,
  priority: 'NORMAL',
  dueInDays: 30,
};

export function suggestTasks(
  topics: readonly SuggestionInputTopic[],
): readonly SuggestedTask[] {
  return [...topics]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .flatMap((topic) => {
      const rules: readonly Rule[] = topic.progressStatus === 'SKIPPED'
        ? [SKIPPED_RULE]
        : topic.outcome === null
          ? []
          : (RULES[topic.outcome] ?? []);

      return rules.map((rule, index): SuggestedTask => ({
        key: `${topic.topicId}:${index}`,
        topicId: topic.topicId,
        topicName: topic.name,
        ownerType: rule.ownerType,
        title: rule.title(topic.name),
        priority: rule.priority,
        dueInDays: rule.dueInDays,
      }));
    });
}

/** Faelligkeit aus Gespraechsdatum und Frist, als ISO-Datum (YYYY-MM-DD). */
export function dueDateFrom(sessionDate: string, dueInDays: number | null): string | null {
  if (dueInDays === null) return null;
  const base = new Date(`${sessionDate}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + dueInDays);
  return base.toISOString().slice(0, 10);
}

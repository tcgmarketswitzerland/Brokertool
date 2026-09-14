import type { Outcome, ProgressStatus } from './status';

/** Ein Beratungsthema, soweit die Fortschrittsrechnung es kennen muss. */
export type TopicProgress = {
  readonly topicId: string;
  readonly isRequired: boolean;
  readonly progressStatus: ProgressStatus;
  readonly outcome: Outcome | null;
};

export type SessionProgress = {
  /** Themen mit einem Ergebnis oder ausdruecklich uebersprungen. */
  readonly settled: number;
  readonly total: number;
  readonly percent: number;
  readonly requiredOpen: number;
  readonly declined: number;
  readonly actionNeeded: number;
};

/** Ein Thema gilt als erledigt, wenn es ein Ergebnis hat oder uebersprungen wurde. */
export function isSettled(topic: TopicProgress): boolean {
  return topic.progressStatus === 'SKIPPED' || topic.outcome !== null;
}

const NEEDS_ACTION: ReadonlySet<Outcome> = new Set<Outcome>([
  'ACTION_REQUIRED', 'OFFER_REQUESTED', 'CONTRACT_REQUESTED', 'FOLLOW_UP',
]);

/**
 * Fortschritt fuer die Anzeige "8 von 14 Themen". Gezaehlt wird, was
 * fachlich erledigt ist, nicht was angeklickt wurde - sonst zeigt der
 * Balken Fortschritt, wo keiner ist.
 */
export function computeProgress(topics: readonly TopicProgress[]): SessionProgress {
  const total = topics.length;
  const settled = topics.filter(isSettled).length;

  return {
    settled,
    total,
    percent: total === 0 ? 0 : Math.round((settled / total) * 100),
    requiredOpen: topics.filter((t) => t.isRequired && !isSettled(t)).length,
    declined: topics.filter((t) => t.outcome === 'CLIENT_DECLINED').length,
    actionNeeded: topics.filter((t) => t.outcome !== null && NEEDS_ACTION.has(t.outcome)).length,
  };
}

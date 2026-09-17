import { err, ok, type Result } from '@/domain/shared/result';

/**
 * Statusmodell der Beratung (Architektur 10.2).
 *
 * Zwei Dimensionen statt eines vermischten Enums: der Konzeptentwurf hatte
 * NOT_STARTED/IN_PROGRESS/REVIEWED/COMPLETED (Bearbeitungsfortschritt) mit
 * ACTION_REQUIRED/CLIENT_DECLINED/FOLLOW_UP (fachliches Ergebnis) in einer
 * Liste. In einem Enum entstehen daraus unmoegliche Zustaende und
 * Diskussionen wie "ist REVIEWED auch COMPLETED?".
 */

export const PROGRESS_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'DISCUSSED', 'SKIPPED'] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const OUTCOMES = [
  'NO_ACTION_NEEDED', 'ACTION_REQUIRED', 'OFFER_REQUESTED',
  'CONTRACT_REQUESTED', 'FOLLOW_UP', 'CLIENT_DECLINED',
] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const COVERAGE_STATES = ['UNKNOWN', 'NO_COVER', 'COVER_EXISTS'] as const;
export type CoverageState = (typeof COVERAGE_STATES)[number];

export const PROGRESS_LABEL: Record<ProgressStatus, string> = {
  NOT_STARTED: 'Nicht besprochen',
  IN_PROGRESS: 'In Bearbeitung',
  DISCUSSED: 'Besprochen',
  SKIPPED: 'Im Gespräch nicht thematisiert',
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  CONTRACT_REQUESTED: 'Offerte unterzeichnen',
  OFFER_REQUESTED: 'Offerte bestellen',
  ACTION_REQUIRED: 'Anpassung gewünscht',
  NO_ACTION_NEEDED: 'Kein Handlungsbedarf seitens Broker',
  CLIENT_DECLINED: 'Kein Handlungsbedarf seitens Kunden',
  FOLLOW_UP: 'Später anschauen',
};

/**
 * Was im Gespraech zur Auswahl steht, in dieser Reihenfolge.
 *
 * Getrennt von OUTCOMES, weil FOLLOW_UP in aelteren Beratungen vorkommt
 * und dort lesbar bleiben muss - angeboten wird es nicht mehr. Einen
 * Enum-Wert aus der Datenbank zu entfernen hiesse, bestehende
 * Dokumentation unlesbar zu machen; das waere ein hoher Preis fuer eine
 * kuerzere Liste.
 *
 * Die Trennung "seitens Broker" und "seitens Kunden" ist keine Feinheit:
 * im ersten Fall sagt der Fachmann, dass nichts zu tun ist, im zweiten
 * entscheidet der Kunde gegen den Rat. Nur der zweite Fall muss im
 * Streitfall belegen, worueber aufgeklaert wurde.
 */
export const SELECTABLE_OUTCOMES = [
  'CONTRACT_REQUESTED', 'OFFER_REQUESTED', 'ACTION_REQUIRED',
  'NO_ACTION_NEEDED', 'CLIENT_DECLINED',
] as const satisfies readonly Outcome[];

export const COVERAGE_LABEL: Record<CoverageState, string> = {
  UNKNOWN: 'Unbekannt',
  NO_COVER: 'Keine Deckung vorhanden',
  COVER_EXISTS: 'Bestehende Lösung vorhanden',
};

/**
 * Erlaubte Uebergaenge. SKIPPED ist von ueberall erreichbar: der Kunde kann
 * jederzeit sagen, dass ihn ein Thema nicht interessiert. Aus SKIPPED
 * zurueck geht es ebenfalls - er kann es sich anders ueberlegen.
 */
const ALLOWED: Record<ProgressStatus, readonly ProgressStatus[]> = {
  NOT_STARTED: ['IN_PROGRESS', 'DISCUSSED', 'SKIPPED'],
  IN_PROGRESS: ['NOT_STARTED', 'DISCUSSED', 'SKIPPED'],
  DISCUSSED: ['IN_PROGRESS', 'SKIPPED'],
  SKIPPED: ['NOT_STARTED', 'IN_PROGRESS', 'DISCUSSED'],
};

export type TransitionError =
  | { kind: 'INVALID_TRANSITION'; from: ProgressStatus; to: ProgressStatus }
  | { kind: 'OUTCOME_WITHOUT_DISCUSSION'; status: ProgressStatus };

export function canTransition(from: ProgressStatus, to: ProgressStatus): boolean {
  return from === to || (ALLOWED[from]?.includes(to) ?? false);
}

export type TopicState = {
  readonly progressStatus: ProgressStatus;
  readonly outcome: Outcome | null;
};

/**
 * Wendet einen Statuswechsel an. Ein Ergebnis ohne Besprechung ist
 * unzulaessig - dieselbe Regel steht als CHECK-Constraint in der Datenbank,
 * damit sie sich auch ueber keinen anderen Weg umgehen laesst.
 */
export function applyProgress(
  current: TopicState,
  next: ProgressStatus,
): Result<TopicState, TransitionError> {
  if (!canTransition(current.progressStatus, next)) {
    return err({ kind: 'INVALID_TRANSITION', from: current.progressStatus, to: next });
  }
  // Wer ein besprochenes Thema zurueckstuft, verliert das Ergebnis - sonst
  // bliebe eine Kundenentscheidung an einem Thema haengen, das laut Status
  // gar nicht besprochen wurde.
  const outcome = next === 'DISCUSSED' ? current.outcome : null;
  return ok({ progressStatus: next, outcome });
}

export function applyOutcome(
  current: TopicState,
  outcome: Outcome | null,
): Result<TopicState, TransitionError> {
  if (outcome !== null && current.progressStatus !== 'DISCUSSED') {
    return err({ kind: 'OUTCOME_WITHOUT_DISCUSSION', status: current.progressStatus });
  }
  return ok({ ...current, outcome });
}

/** Ein Ergebnis zu setzen bedeutet fachlich, dass besprochen wurde. */
export function discussWith(outcome: Outcome): TopicState {
  return { progressStatus: 'DISCUSSED', outcome };
}

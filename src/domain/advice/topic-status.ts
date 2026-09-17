import type { Outcome, ProgressStatus } from './status';

/**
 * Der eine Zustand, den das Rad und die Liste anzeigen. Aus den zwei
 * fachlichen Dimensionen wird hier genau eine Anzeigekategorie abgeleitet -
 * an einer Stelle, damit Rad, Liste, Kennzeichnungen und spaeter das PDF
 * nicht auseinanderlaufen.
 */
export const DISPLAY_STATES = [
  'NOT_STARTED', 'IN_PROGRESS', 'NO_ACTION', 'ACTION', 'DECLINED', 'FOLLOW_UP', 'SKIPPED',
] as const;
export type DisplayState = (typeof DISPLAY_STATES)[number];

export function toDisplayState(
  progressStatus: ProgressStatus,
  outcome: Outcome | null,
): DisplayState {
  if (progressStatus === 'SKIPPED') return 'SKIPPED';

  switch (outcome) {
    case 'NO_ACTION_NEEDED': return 'NO_ACTION';
    case 'CLIENT_DECLINED': return 'DECLINED';
    case 'FOLLOW_UP': return 'FOLLOW_UP';
    case 'ACTION_REQUIRED':
    case 'OFFER_REQUESTED':
    case 'CONTRACT_REQUESTED': return 'ACTION';
    case null: break;
  }

  return progressStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'NOT_STARTED';
}

/**
 * Farbe UND Symbol. Farbe allein genuegt nicht: Rot und Gruen sind fuer
 * einen relevanten Teil der Menschen nicht unterscheidbar, und das Rad
 * wird dem Kunden gezeigt (Analyse 1.7).
 */
export const DISPLAY_STATE_META: Record<
  DisplayState,
  { label: string; color: string; icon: string }
> = {
  NOT_STARTED: { label: 'Nicht besprochen', color: 'var(--status-not-started)', icon: 'circle-dashed' },
  IN_PROGRESS: { label: 'In Bearbeitung',   color: 'var(--status-progress)',    icon: 'circle-dot' },
  NO_ACTION:   { label: 'Kein Bedarf seitens Broker', color: 'var(--status-no-action)', icon: 'check' },
  ACTION:      { label: 'Handlungsbedarf',  color: 'var(--status-action)',      icon: 'alert' },
  DECLINED:    { label: 'Kein Bedarf seitens Kunden', color: 'var(--status-declined)', icon: 'slash' },
  FOLLOW_UP:   { label: 'Später anschauen', color: 'var(--status-follow-up)',   icon: 'clock' },
  SKIPPED:     { label: 'Nicht thematisiert', color: 'var(--status-not-started)', icon: 'minus' },
};

import { err, ok, type Result } from '@/domain/shared/result';
import type { TopicProgress } from './progress';

/**
 * Wann eine Beratung abschliessbar ist.
 *
 * Frueher galt: jede Pflichtsparte braucht ein Ergebnis. Das passte nicht
 * zum echten Gespraech - ein Kunde kommt wegen einer Sparte und hat eine
 * Stunde Zeit. Jetzt genuegt eine besprochene Sparte; alle uebrigen werden
 * beim Abschluss ausdruecklich als "im Gespraech nicht thematisiert"
 * festgehalten.
 *
 * Das Versprechen "kein Bereich wird vergessen" bleibt damit bestehen, nur
 * anders eingeloest: nicht durch eine Sperre, sondern dadurch, dass zu
 * jeder Sparte ein Satz im Protokoll steht. Eine Luecke muss man spaeter
 * erklaeren, einen dokumentierten Satz nicht.
 */

export type CompletionBlocker =
  | { kind: 'NOTHING_DISCUSSED' }
  | { kind: 'ALREADY_COMPLETED' }
  | { kind: 'NOT_STARTED' }
  | { kind: 'NO_TOPICS' };

export type SessionForCompletion = {
  readonly status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  readonly topics: readonly TopicProgress[];
};

export function canCompleteSession(
  session: SessionForCompletion,
): Result<true, CompletionBlocker> {
  if (session.status === 'COMPLETED') return err({ kind: 'ALREADY_COMPLETED' });
  if (session.status === 'CANCELLED') return err({ kind: 'NOT_STARTED' });
  if (session.topics.length === 0) return err({ kind: 'NO_TOPICS' });

  // Eine Beratung ohne eine einzige besprochene Sparte ist keine Beratung.
  // Ihr Protokoll wuerde nichts belegen.
  if (!session.topics.some((t) => t.outcome !== null)) {
    return err({ kind: 'NOTHING_DISCUSSED' });
  }

  return ok(true);
}

/**
 * Was beim Abschluss aus einer unberuehrten Sparte wird.
 *
 * Dieselbe Regel laeuft in der Datenbank (Migration 0022). Hier steht sie,
 * damit die Vorschau vor dem Abschluss genau das zeigt, was danach im
 * Protokoll steht - eine Vorschau, die etwas anderes zeigt als das
 * Ergebnis, waere schlimmer als gar keine.
 */
export function settleUntouched<T extends TopicProgress>(topic: T): T {
  if (topic.outcome !== null || topic.progressStatus === 'SKIPPED') return topic;
  return { ...topic, progressStatus: 'SKIPPED' as const, outcome: null };
}

import { err, ok, type Result } from '@/domain/shared/result';
import { isSettled, type TopicProgress } from './progress';

/**
 * Die zentrale Produktregel: eine Beratung ist erst abschliessbar, wenn
 * jedes Pflichtthema ein Ergebnis hat oder ausdruecklich uebersprungen
 * wurde.
 *
 * Das ist die technische Fassung des Versprechens "kein Bereich wird
 * vergessen" - und damit der wichtigste Testfall im gesamten System.
 */

export type CompletionBlocker =
  | { kind: 'MISSING_REQUIRED'; topics: readonly string[] }
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

  const missing = session.topics
    .filter((t) => t.isRequired && !isSettled(t))
    .map((t) => t.topicId);

  if (missing.length > 0) return err({ kind: 'MISSING_REQUIRED', topics: missing });

  return ok(true);
}

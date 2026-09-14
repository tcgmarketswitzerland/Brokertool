'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CommandPayload } from '@/domain/advice/commands';
import { applyCommand, type SessionState } from '@/domain/advice/session-state';
import { computeProgress } from '@/domain/advice/progress';
import { SyncEngine, type SyncStatus } from '@/lib/sync/sync-engine';

/**
 * Zustand einer laufenden Beratung im Browser.
 *
 * Der Ablauf: Befehl erzeugen, optimistisch anwenden, in den Ausgangskorb
 * legen, im Hintergrund uebertragen. Der Berater sieht seine Eingabe
 * sofort - auch wenn gerade kein Netz da ist (ADR-002).
 *
 * Angewendet wird derselbe Reducer, der auch auf dem Server laeuft. Das ist
 * der Grund fuer die framework-freie Domaene.
 */
export function useAdviceSession(sessionId: string, initial: SessionState) {
  const [state, setState] = useState(initial);
  const [sync, setSync] = useState<SyncStatus>({ kind: 'idle', pending: 0 });
  const engineRef = useRef<SyncEngine | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const engine = new SyncEngine(sessionId);
    engineRef.current = engine;
    const unsubscribe = engine.subscribe(setSync);
    engine.start();
    return () => {
      unsubscribe();
      engine.stop();
      engineRef.current = null;
    };
  }, [sessionId]);

  const dispatch = useCallback(
    (payload: CommandPayload) => {
      const result = applyCommand(state, payload);
      if (!result.ok) return result.error;

      setState(result.state);
      seqRef.current += 1;

      void engineRef.current?.submit({
        id: crypto.randomUUID(),
        sessionId,
        clientSeq: seqRef.current,
        clientTs: Date.now(),
        payload,
      });

      return null;
    },
    [sessionId, state],
  );

  const topics = useMemo(() => Object.values(state.topics), [state.topics]);

  const progress = useMemo(
    () => computeProgress(topics.map((t) => ({
      topicId: t.topicId,
      isRequired: t.isRequired,
      progressStatus: t.progressStatus,
      outcome: t.outcome,
    }))),
    [topics],
  );

  return { state, topics, progress, sync, dispatch };
}

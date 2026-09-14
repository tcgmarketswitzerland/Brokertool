import { applyOutcome, applyProgress, type CoverageState, type Outcome, type ProgressStatus } from './status';
import type { CommandPayload } from './commands';

/**
 * Der Zustand einer laufenden Beratung, soweit die Befehle ihn veraendern.
 * Bewusst schmal: was hier nicht steht, wird auch nicht optimistisch
 * angezeigt und muss den Server nicht belasten.
 */

export type TopicState = {
  readonly topicId: string;
  readonly isRequired: boolean;
  readonly displayOrder: number;
  readonly progressStatus: ProgressStatus;
  readonly outcome: Outcome | null;
  readonly coverageState: CoverageState;
  readonly priority: number | null;
};

export type NoteState = {
  readonly id: string;
  readonly topicId: string | null;
  readonly visibility: 'INTERNAL' | 'SHARED';
  readonly body: string;
};

export type SessionState = {
  readonly topics: Readonly<Record<string, TopicState>>;
  readonly notes: Readonly<Record<string, NoteState>>;
};

export type ApplyError =
  | { kind: 'UNKNOWN_TOPIC'; topicId: string }
  | { kind: 'INVALID_TRANSITION'; from: ProgressStatus; to: ProgressStatus }
  | { kind: 'OUTCOME_WITHOUT_DISCUSSION'; status: ProgressStatus };

export type ApplyResult =
  | { ok: true; state: SessionState }
  | { ok: false; error: ApplyError };

function withTopic(state: SessionState, topic: TopicState): SessionState {
  return { ...state, topics: { ...state.topics, [topic.topicId]: topic } };
}

/**
 * Wendet einen Befehl an. Reine Funktion: gleicher Zustand plus gleicher
 * Befehl ergibt immer dasselbe Ergebnis - Voraussetzung dafuer, dass
 * Browser und Server unabhaengig voneinander zum selben Stand kommen.
 */
export function applyCommand(state: SessionState, command: CommandPayload): ApplyResult {
  switch (command.type) {
    case 'TOPIC_SET_PROGRESS': {
      const topic = state.topics[command.topicId];
      if (!topic) return { ok: false, error: { kind: 'UNKNOWN_TOPIC', topicId: command.topicId } };

      const next = applyProgress(
        { progressStatus: topic.progressStatus, outcome: topic.outcome },
        command.progressStatus,
      );
      if (!next.ok) return { ok: false, error: next.error };

      return { ok: true, state: withTopic(state, { ...topic, ...next.value }) };
    }

    case 'TOPIC_SET_OUTCOME': {
      const topic = state.topics[command.topicId];
      if (!topic) return { ok: false, error: { kind: 'UNKNOWN_TOPIC', topicId: command.topicId } };

      // Ein Ergebnis zu setzen bedeutet fachlich, dass besprochen wurde.
      // Der Berater tippt im Gespraech auf "Offerte gewuenscht" und soll
      // nicht vorher noch auf "besprochen" tippen muessen.
      const base = command.outcome !== null && topic.progressStatus !== 'DISCUSSED'
        ? { ...topic, progressStatus: 'DISCUSSED' as const }
        : topic;

      const next = applyOutcome(
        { progressStatus: base.progressStatus, outcome: base.outcome },
        command.outcome,
      );
      if (!next.ok) return { ok: false, error: next.error };

      return { ok: true, state: withTopic(state, { ...base, ...next.value }) };
    }

    case 'TOPIC_SET_COVERAGE': {
      const topic = state.topics[command.topicId];
      if (!topic) return { ok: false, error: { kind: 'UNKNOWN_TOPIC', topicId: command.topicId } };
      return { ok: true, state: withTopic(state, { ...topic, coverageState: command.coverageState }) };
    }

    case 'TOPIC_SET_PRIORITY': {
      const topic = state.topics[command.topicId];
      if (!topic) return { ok: false, error: { kind: 'UNKNOWN_TOPIC', topicId: command.topicId } };
      return { ok: true, state: withTopic(state, { ...topic, priority: command.priority }) };
    }

    case 'NOTE_UPSERT': {
      const note: NoteState = {
        id: command.noteId,
        topicId: command.topicId,
        visibility: command.visibility,
        body: command.body,
      };
      return { ok: true, state: { ...state, notes: { ...state.notes, [note.id]: note } } };
    }

    case 'NOTE_DELETE': {
      const notes = { ...state.notes };
      delete notes[command.noteId];
      return { ok: true, state: { ...state, notes } };
    }
  }
}

/** Mehrere Befehle der Reihe nach. Ein fehlerhafter bricht die Kette nicht ab. */
export function applyAll(
  state: SessionState,
  commands: readonly CommandPayload[],
): { state: SessionState; rejected: { index: number; error: ApplyError }[] } {
  let current = state;
  const rejected: { index: number; error: ApplyError }[] = [];

  commands.forEach((command, index) => {
    const result = applyCommand(current, command);
    if (result.ok) current = result.state;
    else rejected.push({ index, error: result.error });
  });

  return { state: current, rejected };
}

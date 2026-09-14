import { describe, expect, it } from 'vitest';
import { batchSchema, commandSchema } from '@/domain/advice/commands';
import { applyAll, applyCommand, type SessionState } from '@/domain/advice/session-state';

const TOPIC = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const NOTE = '33333333-3333-4333-8333-333333333333';

const base: SessionState = {
  topics: {
    [TOPIC]: {
      topicId: TOPIC, isRequired: true, displayOrder: 10,
      progressStatus: 'NOT_STARTED', outcome: null, coverageState: 'UNKNOWN', priority: null,
    },
  },
  notes: {},
};

describe('Befehle prüfen', () => {
  it('weist einen unbekannten Befehlstyp zurueck', () => {
    expect(commandSchema.safeParse({ type: 'TOPIC_NUKE', topicId: TOPIC }).success).toBe(false);
  });

  it('weist einen unzulaessigen Status zurueck', () => {
    expect(commandSchema.safeParse({
      type: 'TOPIC_SET_PROGRESS', topicId: TOPIC, progressStatus: 'ERLEDIGT',
    }).success).toBe(false);
  });

  it('weist eine zu lange Notiz zurueck', () => {
    expect(commandSchema.safeParse({
      type: 'NOTE_UPSERT', noteId: NOTE, topicId: null, visibility: 'SHARED',
      body: 'x'.repeat(10_001),
    }).success).toBe(false);
  });

  it('begrenzt die Zahl der Befehle je Uebertragung', () => {
    const one = {
      id: NOTE, sessionId: TOPIC, clientSeq: 1, clientTs: 0,
      payload: { type: 'TOPIC_SET_COVERAGE', topicId: TOPIC, coverageState: 'NO_COVER' },
    };
    expect(batchSchema.safeParse({
      sessionId: TOPIC, deviceId: 'geraet-0001',
      commands: Array.from({ length: 201 }, () => one),
    }).success).toBe(false);
  });
});

describe('Befehle anwenden', () => {
  it('setzt den Fortschritt', () => {
    const result = applyCommand(base, {
      type: 'TOPIC_SET_PROGRESS', topicId: TOPIC, progressStatus: 'IN_PROGRESS',
    });
    expect(result.ok && result.state.topics[TOPIC]?.progressStatus).toBe('IN_PROGRESS');
  });

  it('ein Ergebnis zu setzen bedeutet zugleich besprochen', () => {
    // Der Berater tippt im Gespraech auf "Offerte gewuenscht" und soll nicht
    // vorher noch auf "besprochen" tippen muessen.
    const result = applyCommand(base, {
      type: 'TOPIC_SET_OUTCOME', topicId: TOPIC, outcome: 'OFFER_REQUESTED',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.topics[TOPIC]?.progressStatus).toBe('DISCUSSED');
      expect(result.state.topics[TOPIC]?.outcome).toBe('OFFER_REQUESTED');
    }
  });

  it('meldet ein unbekanntes Thema statt es anzulegen', () => {
    const result = applyCommand(base, {
      type: 'TOPIC_SET_COVERAGE', topicId: OTHER, coverageState: 'NO_COVER',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('UNKNOWN_TOPIC');
  });

  it('aendert den Ausgangszustand nicht', () => {
    applyCommand(base, { type: 'TOPIC_SET_PROGRESS', topicId: TOPIC, progressStatus: 'SKIPPED' });
    expect(base.topics[TOPIC]?.progressStatus).toBe('NOT_STARTED');
  });

  it('ist wiederholbar: derselbe Befehl zweimal ergibt denselben Zustand', () => {
    // Genau das passiert nach einem Netzabbruch, wenn die Outbox erneut
    // sendet.
    const once = applyCommand(base, {
      type: 'TOPIC_SET_OUTCOME', topicId: TOPIC, outcome: 'CLIENT_DECLINED',
    });
    expect(once.ok).toBe(true);
    if (!once.ok) return;

    const twice = applyCommand(once.state, {
      type: 'TOPIC_SET_OUTCOME', topicId: TOPIC, outcome: 'CLIENT_DECLINED',
    });
    expect(twice.ok && twice.state).toEqual(once.state);
  });

  it('legt Notizen an, aendert und entfernt sie', () => {
    const added = applyCommand(base, {
      type: 'NOTE_UPSERT', noteId: NOTE, topicId: TOPIC,
      visibility: 'INTERNAL', body: 'Kunde wirkt unentschlossen',
    });
    expect(added.ok && added.state.notes[NOTE]?.visibility).toBe('INTERNAL');
    if (!added.ok) return;

    const removed = applyCommand(added.state, { type: 'NOTE_DELETE', noteId: NOTE });
    expect(removed.ok && removed.state.notes[NOTE]).toBeUndefined();
  });
});

describe('Mehrere Befehle', () => {
  it('ein fehlerhafter bricht die Kette nicht ab', () => {
    // Im Gespraech waere es fatal, wenn ein einzelner ungueltiger Befehl
    // alle nachfolgenden Eingaben verwirft.
    const { state, rejected } = applyAll(base, [
      { type: 'TOPIC_SET_COVERAGE', topicId: TOPIC, coverageState: 'COVER_EXISTS' },
      { type: 'TOPIC_SET_COVERAGE', topicId: OTHER, coverageState: 'NO_COVER' },
      { type: 'TOPIC_SET_OUTCOME', topicId: TOPIC, outcome: 'ACTION_REQUIRED' },
    ]);

    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.index).toBe(1);
    expect(state.topics[TOPIC]?.coverageState).toBe('COVER_EXISTS');
    expect(state.topics[TOPIC]?.outcome).toBe('ACTION_REQUIRED');
  });

  it('die Reihenfolge entscheidet', () => {
    const { state } = applyAll(base, [
      { type: 'TOPIC_SET_OUTCOME', topicId: TOPIC, outcome: 'ACTION_REQUIRED' },
      { type: 'TOPIC_SET_PROGRESS', topicId: TOPIC, progressStatus: 'SKIPPED' },
    ]);
    // Ueberspringen verwirft das Ergebnis - die letzte Entscheidung gilt.
    expect(state.topics[TOPIC]?.progressStatus).toBe('SKIPPED');
    expect(state.topics[TOPIC]?.outcome).toBeNull();
  });
});

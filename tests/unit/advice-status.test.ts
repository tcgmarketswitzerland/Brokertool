import { describe, expect, it } from 'vitest';
import {
  applyOutcome, applyProgress, canTransition, discussWith,
  type Outcome, type ProgressStatus, type TopicState,
} from '@/domain/advice/status';
import { computeProgress, isSettled, type TopicProgress } from '@/domain/advice/progress';
import { canCompleteSession, settleUntouched } from '@/domain/advice/completion';

const state = (progressStatus: ProgressStatus, outcome: Outcome | null = null): TopicState =>
  ({ progressStatus, outcome });

const topic = (
  topicId: string, isRequired: boolean,
  progressStatus: ProgressStatus, outcome: Outcome | null = null,
): TopicProgress => ({ topicId, isRequired, progressStatus, outcome });

describe('Statusuebergaenge', () => {
  it('erlaubt den normalen Weg', () => {
    expect(canTransition('NOT_STARTED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'DISCUSSED')).toBe(true);
  });

  it('erlaubt Ueberspringen aus jedem Zustand', () => {
    // Der Kunde kann jederzeit sagen, dass ihn ein Thema nicht interessiert.
    for (const from of ['NOT_STARTED', 'IN_PROGRESS', 'DISCUSSED'] as const) {
      expect(canTransition(from, 'SKIPPED'), from).toBe(true);
    }
  });

  it('erlaubt die Rueckkehr aus dem Ueberspringen', () => {
    // Er kann es sich anders ueberlegen.
    expect(canTransition('SKIPPED', 'DISCUSSED')).toBe(true);
  });

  it('erlaubt denselben Zustand erneut, damit ein wiederholter Befehl nicht scheitert', () => {
    expect(canTransition('DISCUSSED', 'DISCUSSED')).toBe(true);
  });

  it('verbietet den Sprung von DISCUSSED zurueck auf NOT_STARTED', () => {
    expect(canTransition('DISCUSSED', 'NOT_STARTED')).toBe(false);
  });
});

describe('Ergebnis setzen', () => {
  it('nur an einem besprochenen Thema', () => {
    const result = applyOutcome(state('IN_PROGRESS'), 'ACTION_REQUIRED');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('OUTCOME_WITHOUT_DISCUSSION');
  });

  it('gelingt am besprochenen Thema', () => {
    const result = applyOutcome(state('DISCUSSED'), 'OFFER_REQUESTED');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.outcome).toBe('OFFER_REQUESTED');
  });

  it('laesst sich wieder entfernen', () => {
    const result = applyOutcome(state('DISCUSSED', 'ACTION_REQUIRED'), null);
    expect(result.ok && result.value.outcome).toBeNull();
  });

  it('ein Ergebnis zu setzen bedeutet fachlich besprochen', () => {
    expect(discussWith('CLIENT_DECLINED')).toEqual({
      progressStatus: 'DISCUSSED', outcome: 'CLIENT_DECLINED',
    });
  });
});

describe('Zuruecksetzen verliert das Ergebnis', () => {
  it('beim Zurueckstufen auf IN_PROGRESS', () => {
    // Sonst bliebe eine Kundenentscheidung an einem Thema haengen, das laut
    // Status gar nicht besprochen wurde.
    const result = applyProgress(state('DISCUSSED', 'CONTRACT_REQUESTED'), 'IN_PROGRESS');
    expect(result.ok && result.value.outcome).toBeNull();
  });

  it('beim Ueberspringen', () => {
    const result = applyProgress(state('DISCUSSED', 'ACTION_REQUIRED'), 'SKIPPED');
    expect(result.ok && result.value.outcome).toBeNull();
  });

  it('behaelt es beim Bleiben auf DISCUSSED', () => {
    const result = applyProgress(state('DISCUSSED', 'ACTION_REQUIRED'), 'DISCUSSED');
    expect(result.ok && result.value.outcome).toBe('ACTION_REQUIRED');
  });
});

describe('Fortschritt', () => {
  it('zaehlt nur fachlich erledigte Themen', () => {
    // Angeklickt ist nicht erledigt: sonst zeigt der Balken Fortschritt,
    // wo keiner ist.
    expect(isSettled(topic('a', false, 'IN_PROGRESS'))).toBe(false);
    expect(isSettled(topic('a', false, 'DISCUSSED'))).toBe(false);
    expect(isSettled(topic('a', false, 'DISCUSSED', 'NO_ACTION_NEEDED'))).toBe(true);
    expect(isSettled(topic('a', false, 'SKIPPED'))).toBe(true);
  });

  it('rechnet acht von vierzehn korrekt', () => {
    const topics = [
      ...Array.from({ length: 8 }, (_, i) => topic(`d${i}`, false, 'DISCUSSED', 'NO_ACTION_NEEDED')),
      ...Array.from({ length: 6 }, (_, i) => topic(`o${i}`, false, 'NOT_STARTED')),
    ];
    const p = computeProgress(topics);
    expect(p.settled).toBe(8);
    expect(p.total).toBe(14);
    expect(p.percent).toBe(57);
  });

  it('zaehlt offene Pflichtthemen getrennt', () => {
    const p = computeProgress([
      topic('a', true, 'NOT_STARTED'),
      topic('b', true, 'DISCUSSED', 'NO_ACTION_NEEDED'),
      topic('c', false, 'NOT_STARTED'),
    ]);
    expect(p.requiredOpen).toBe(1);
  });

  it('zaehlt Ablehnungen und Handlungsbedarf', () => {
    const p = computeProgress([
      topic('a', false, 'DISCUSSED', 'CLIENT_DECLINED'),
      topic('b', false, 'DISCUSSED', 'OFFER_REQUESTED'),
      topic('c', false, 'DISCUSSED', 'ACTION_REQUIRED'),
      topic('d', false, 'DISCUSSED', 'NO_ACTION_NEEDED'),
    ]);
    expect(p.declined).toBe(1);
    expect(p.actionNeeded).toBe(2);
  });

  it('kommt mit einer leeren Beratung zurecht', () => {
    expect(computeProgress([])).toMatchObject({ settled: 0, total: 0, percent: 0 });
  });
});

describe('Abschlussregel — eine Sparte genuegt, der Rest wird festgehalten', () => {
  it('erlaubt den Abschluss ab einer besprochenen Sparte', () => {
    // Der echte Fall: der Kunde kommt wegen einer Sparte und hat eine
    // Stunde Zeit. Alles Uebrige geht als "nicht thematisiert" ins
    // Protokoll, nicht als Luecke.
    const result = canCompleteSession({
      status: 'IN_PROGRESS',
      topics: [
        topic('hausrat', true, 'DISCUSSED', 'NO_ACTION_NEEDED'),
        topic('vorsorge', true, 'IN_PROGRESS'),
        topic('reise', false, 'NOT_STARTED'),
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('verweigert den Abschluss, solange keine einzige Sparte ein Ergebnis hat', () => {
    // Ein Protokoll ohne ein einziges Ergebnis belegt nichts.
    const result = canCompleteSession({
      status: 'IN_PROGRESS',
      topics: [topic('vorsorge', true, 'IN_PROGRESS'), topic('reise', false, 'NOT_STARTED')],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('NOTHING_DISCUSSED');
  });

  it('zaehlt eine uebersprungene Sparte nicht als Ergebnis', () => {
    // Uebersprungen heisst "nicht besprochen" - daraus laesst sich kein
    // Protokoll bauen, das etwas aussagt.
    const result = canCompleteSession({
      status: 'IN_PROGRESS',
      topics: [topic('vorsorge', true, 'SKIPPED'), topic('reise', false, 'NOT_STARTED')],
    });
    expect(result.ok).toBe(false);
  });

  it('eine Ablehnung zaehlt als Ergebnis', () => {
    const result = canCompleteSession({
      status: 'IN_PROGRESS',
      topics: [topic('vorsorge', true, 'DISCUSSED', 'CLIENT_DECLINED')],
    });
    expect(result.ok).toBe(true);
  });

  it('eine abgeschlossene Beratung laesst sich nicht erneut abschliessen', () => {
    const result = canCompleteSession({ status: 'COMPLETED', topics: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('ALREADY_COMPLETED');
  });

  it('eine Beratung ohne Themen ist kein gueltiger Abschluss', () => {
    const result = canCompleteSession({ status: 'IN_PROGRESS', topics: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('NO_TOPICS');
  });
});

describe('Unberuehrte Sparten beim Abschluss', () => {
  it('macht aus einer unberuehrten Sparte "nicht thematisiert"', () => {
    expect(settleUntouched(topic('reise', false, 'NOT_STARTED')))
      .toMatchObject({ progressStatus: 'SKIPPED', outcome: null });
  });

  it('laesst eine besprochene Sparte unveraendert', () => {
    const discussed = topic('hausrat', true, 'DISCUSSED', 'OFFER_REQUESTED');
    expect(settleUntouched(discussed)).toBe(discussed);
  });

  it('laesst eine bereits uebersprungene Sparte unveraendert', () => {
    const skipped = topic('cyber', false, 'SKIPPED');
    expect(settleUntouched(skipped)).toBe(skipped);
  });
});


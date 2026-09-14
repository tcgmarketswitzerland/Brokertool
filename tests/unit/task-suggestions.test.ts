import { describe, expect, it } from 'vitest';
import { dueDateFrom, suggestTasks, type SuggestionInputTopic } from '@/domain/task/suggestions';

/**
 * Folgeaufgaben aus dem Gespraech. Das Kernversprechen lautet "automatisch",
 * also ist die Ableitung selbst die Funktion, die stimmen muss.
 */

function topic(over: Partial<SuggestionInputTopic> = {}): SuggestionInputTopic {
  return {
    topicId: '11111111-1111-4111-8111-111111111111',
    name: 'Hausrat',
    displayOrder: 1,
    outcome: null,
    progressStatus: 'DISCUSSED',
    ...over,
  };
}

describe('Ableitung', () => {
  it('erzeugt zu einer gewuenschten Offerte eine Berateraufgabe', () => {
    const [task, ...rest] = suggestTasks([topic({ outcome: 'OFFER_REQUESTED' })]);
    expect(rest).toHaveLength(0);
    expect(task?.ownerType).toBe('ADVISOR');
    expect(task?.title).toBe('Offerte einholen: Hausrat');
    expect(task?.priority).toBe('HIGH');
  });

  it('teilt einen Abschlusswunsch auf beide Seiten auf', () => {
    // Der Berater stellt den Antrag, der Kunde liefert die Unterlagen -
    // ohne die zweite Aufgabe bleibt der Antrag beim Berater liegen.
    const tasks = suggestTasks([topic({ outcome: 'CONTRACT_REQUESTED' })]);
    expect(tasks.map((t) => t.ownerType)).toEqual(['ADVISOR', 'CUSTOMER']);
  });

  it('erzeugt zu einer Ablehnung keine Aufgabe', () => {
    // Nachfassen gegen den ausdruecklichen Willen des Kunden waere genau
    // das Verhalten, das der Ablehnungstext ausschliesst.
    expect(suggestTasks([topic({ outcome: 'CLIENT_DECLINED' })])).toEqual([]);
  });

  it('erzeugt zu "kein Handlungsbedarf" keine Aufgabe', () => {
    expect(suggestTasks([topic({ outcome: 'NO_ACTION_NEEDED' })])).toEqual([]);
  });

  it('erzeugt zu einer uebersprungenen Sparte eine Nachholaufgabe', () => {
    const [task] = suggestTasks([topic({ progressStatus: 'SKIPPED', outcome: null })]);
    expect(task?.title).toBe('Nicht behandelt: Hausrat nachholen');
    expect(task?.ownerType).toBe('ADVISOR');
  });

  it('erzeugt zu einer offenen Sparte nichts', () => {
    expect(suggestTasks([topic({ progressStatus: 'NOT_STARTED' })])).toEqual([]);
  });

  it('haelt die Reihenfolge des Katalogs ein', () => {
    const tasks = suggestTasks([
      topic({ topicId: 'b', name: 'Auto', displayOrder: 2, outcome: 'OFFER_REQUESTED' }),
      topic({ topicId: 'a', name: 'Hausrat', displayOrder: 1, outcome: 'OFFER_REQUESTED' }),
    ]);
    expect(tasks.map((t) => t.topicName)).toEqual(['Hausrat', 'Auto']);
  });

  it('vergibt je Sparte eindeutige Schluessel', () => {
    const tasks = suggestTasks([
      topic({ topicId: 'a', outcome: 'CONTRACT_REQUESTED' }),
      topic({ topicId: 'b', displayOrder: 2, outcome: 'CONTRACT_REQUESTED' }),
    ]);
    expect(new Set(tasks.map((t) => t.key)).size).toBe(tasks.length);
  });
});

describe('Faelligkeit', () => {
  it('rechnet die Frist auf das Gespraechsdatum', () => {
    expect(dueDateFrom('2026-03-02', 7)).toBe('2026-03-09');
  });

  it('rechnet ueber Monatsgrenzen hinweg', () => {
    expect(dueDateFrom('2026-01-28', 5)).toBe('2026-02-02');
  });

  it('rechnet ueber den Jahreswechsel', () => {
    expect(dueDateFrom('2026-12-30', 5)).toBe('2027-01-04');
  });

  it('beruecksichtigt Schaltjahre', () => {
    expect(dueDateFrom('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('laesst eine Aufgabe ohne Frist ohne Datum', () => {
    expect(dueDateFrom('2026-03-02', null)).toBeNull();
  });

  it('gibt bei unbrauchbarem Datum null zurueck statt zu raten', () => {
    expect(dueDateFrom('kein Datum', 7)).toBeNull();
  });
});

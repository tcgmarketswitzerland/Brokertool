import { describe, expect, it } from 'vitest';
import {
  add, clampToZero, formatAmount, formatCHF, fromFranken, rappen, subtract,
} from '@/domain/shared/money';

describe('Geldbetraege', () => {
  it('weist nicht ganzzahlige Rappen zurueck', () => {
    expect(() => rappen(10.5)).toThrow();
  });

  it('rechnet Franken verlustfrei in Rappen um', () => {
    expect(fromFranken(480)).toBe(48_000);
    expect(fromFranken(0.1)).toBe(10);
  });

  it('vermeidet den klassischen Gleitkommafehler', () => {
    // 0.1 + 0.2 !== 0.3 in Gleitkomma. In Rappen stimmt es.
    expect(add(fromFranken(0.1), fromFranken(0.2))).toBe(fromFranken(0.3));
  });

  it('summiert Vorsorgeleistungen korrekt', () => {
    const total = add(fromFranken(28_000), fromFranken(42_000), fromFranken(0));
    expect(total).toBe(fromFranken(70_000));
    expect(subtract(fromFranken(100_000), total)).toBe(fromFranken(30_000));
  });

  it('kennt keine negative Versorgungsluecke', () => {
    expect(clampToZero(subtract(fromFranken(70_000), fromFranken(100_000)))).toBe(0);
  });

  it('formatiert in Schweizer Schreibweise', () => {
    expect(formatCHF(fromFranken(48_000))).toContain('48');
  });
});

describe('Schweizer Schreibweise', () => {
  it('trennt Tausender mit Apostroph', () => {
    expect(formatAmount(1920)).toBe("1'920");
    expect(formatAmount(1_234_567)).toBe("1'234'567");
  });

  it('zeigt Rappen nur, wenn welche da sind', () => {
    expect(formatAmount(480)).toBe('480');
    expect(formatAmount(480.5)).toBe('480.50');
    expect(formatAmount(120.35)).toBe('120.35');
  });

  it('formatiert Betraege unter tausend ohne Trenner', () => {
    expect(formatAmount(999)).toBe('999');
  });

  it('behaelt das Vorzeichen', () => {
    expect(formatAmount(-1920)).toBe("-1'920");
  });

  it('liefert denselben Text wie formatCHF', () => {
    expect(formatCHF(rappen(192_000))).toBe("CHF 1'920");
  });

  it('haengt nicht von der Umgebung ab', () => {
    // Der Grund fuer die eigene Funktion: Intl liefert je nach
    // Zeichensatzdaten einen anderen Apostroph, und schon das kostet beim
    // Abgleich im Browser den gesamten servergerenderten Baum.
    expect(formatAmount(1000)).toBe("1'000");
    expect(formatAmount(1000).charCodeAt(1)).toBe(39);
  });
});

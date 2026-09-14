import { describe, expect, it } from 'vitest';
import { add, clampToZero, formatCHF, fromFranken, rappen, subtract } from '@/domain/shared/money';

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

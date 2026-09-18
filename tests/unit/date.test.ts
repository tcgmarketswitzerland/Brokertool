import { describe, expect, it } from 'vitest';
import { formatDate, formatDateLong } from '@/domain/shared/date';

describe('formatDate', () => {
  it('schreibt das Schweizer Format', () => {
    expect(formatDate('2026-09-18')).toBe('18.09.2026');
    expect(formatDate('2026-01-05')).toBe('05.01.2026');
  });

  // Der Zeitstempel kommt aus der Datenbank in UTC. Waere er als Zeitpunkt
  // gelesen worden, ergaebe eine Zeitzone westlich davon den Vortag.
  it('liest einen Zeitstempel als Kalendertag', () => {
    expect(formatDate('2026-09-18T00:30:00.000Z')).toBe('18.09.2026');
    expect(formatDate('2026-09-18T23:30:00+02:00')).toBe('18.09.2026');
  });

  it('gibt bei Unsinn nichts aus statt "Invalid Date"', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('irgendwas')).toBe('');
    expect(formatDate('2026-13-01')).toBe('');
  });
});

describe('formatDateLong', () => {
  it('schreibt den Monat aus', () => {
    expect(formatDateLong('2026-09-18')).toBe('18. September 2026');
    expect(formatDateLong('2026-03-01')).toBe('01. März 2026');
  });

  it('gibt bei Unsinn nichts aus', () => {
    expect(formatDateLong('2026-00-10')).toBe('');
  });
});

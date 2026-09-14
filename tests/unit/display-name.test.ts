import { describe, expect, it } from 'vitest';
import { buildDisplayName } from '@/domain/customer/display-name';

const p = (firstName: string, lastName: string, role: 'PRIMARY' | 'PARTNER' | 'CHILD') =>
  ({ firstName, lastName, role }) as const;

describe('Anzeigename', () => {
  it('Einzelperson', () => {
    expect(buildDisplayName('PRIVATE', [p('Max', 'Muster', 'PRIMARY')])).toBe('Max Muster');
  });

  it('Paar mit gleichem Nachnamen nennt ihn einmal', () => {
    expect(buildDisplayName('COUPLE', [
      p('Max', 'Muster', 'PRIMARY'), p('Anna', 'Muster', 'PARTNER'),
    ])).toBe('Max und Anna Muster');
  });

  it('Paar mit verschiedenen Nachnamen nennt beide', () => {
    expect(buildDisplayName('COUPLE', [
      p('Max', 'Muster', 'PRIMARY'), p('Anna', 'Beispiel', 'PARTNER'),
    ])).toBe('Max Muster und Anna Beispiel');
  });

  it('Familie', () => {
    expect(buildDisplayName('FAMILY', [
      p('Max', 'Muster', 'PRIMARY'), p('Anna', 'Muster', 'PARTNER'), p('Lea', 'Muster', 'CHILD'),
    ])).toBe('Familie Muster');
  });

  it('Kinder zaehlen nicht zum Namen', () => {
    expect(buildDisplayName('PRIVATE', [
      p('Max', 'Muster', 'PRIMARY'), p('Lea', 'Muster', 'CHILD'),
    ])).toBe('Max Muster');
  });

  it('Hauptperson steht vorn, unabhaengig von der Reihenfolge', () => {
    expect(buildDisplayName('COUPLE', [
      p('Anna', 'Muster', 'PARTNER'), p('Max', 'Muster', 'PRIMARY'),
    ])).toBe('Max und Anna Muster');
  });

  it('ohne Person ein lesbarer Platzhalter', () => {
    expect(buildDisplayName('PRIVATE', [])).toBe('Ohne Namen');
  });

  it('Familie ohne gemeinsamen Nachnamen faellt auf die Aufzaehlung zurueck', () => {
    expect(buildDisplayName('FAMILY', [
      p('Max', 'Muster', 'PRIMARY'), p('Anna', 'Beispiel', 'PARTNER'),
    ])).toBe('Max Muster und Anna Beispiel');
  });
});

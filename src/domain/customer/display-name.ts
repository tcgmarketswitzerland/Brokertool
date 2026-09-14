import type { CustomerType, PersonRole } from './types';

type NamedPerson = {
  readonly firstName: string;
  readonly lastName: string;
  readonly role: PersonRole;
};

/**
 * Bildet denselben Anzeigenamen wie der Datenbanktrigger.
 *
 * Warum doppelt: In der Datenbank, damit jede Zeile einen Namen hat, egal
 * welcher Weg sie erzeugt hat - auch ein CSV-Import oder eine Migration.
 * Hier, damit die Oberflaeche den Namen sofort zeigen kann, ohne auf die
 * Antwort des Servers zu warten. Der Test unten haelt beide Fassungen
 * aufeinander abgestimmt.
 */
export function buildDisplayName(
  type: CustomerType,
  persons: readonly NamedPerson[],
): string {
  const adults = persons.filter((p) => p.role === 'PRIMARY' || p.role === 'PARTNER');
  if (adults.length === 0) return 'Ohne Namen';

  const ordered = [...adults].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'PRIMARY' ? -1 : 1;
    return a.firstName.localeCompare(b.firstName, 'de-CH');
  });

  const surnames = new Set(ordered.map((p) => p.lastName));
  const sharedSurname = surnames.size === 1 ? ordered[0]!.lastName : null;

  if (type === 'FAMILY' && sharedSurname) return `Familie ${sharedSurname}`;

  if (sharedSurname) {
    return `${ordered.map((p) => p.firstName).join(' und ')} ${sharedSurname}`;
  }
  return ordered.map((p) => `${p.firstName} ${p.lastName}`).join(' und ');
}

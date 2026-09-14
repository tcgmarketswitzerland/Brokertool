import { describe, expect, it } from 'vitest';
import {
  detectDelimiter, guessMapping, mapRows, normalizeDate, parseCsv,
} from '@/domain/customer/csv';

describe('Trennzeichen erkennen', () => {
  it('erkennt Semikolon — die Vorgabe von Excel in der Schweiz', () => {
    expect(detectDelimiter('Vorname;Nachname;PLZ')).toBe(';');
  });
  it('erkennt Komma', () => {
    expect(detectDelimiter('Vorname,Nachname,PLZ')).toBe(',');
  });
  it('erkennt Tabulator', () => {
    expect(detectDelimiter('Vorname\tNachname\tPLZ')).toBe('\t');
  });
});

describe('CSV einlesen', () => {
  it('entfernt das BOM, sonst wird die erste Spalte nie zugeordnet', () => {
    const table = parseCsv('\uFEFFVorname;Nachname\nMax;Muster');
    expect(table.headers).toEqual(['Vorname', 'Nachname']);
  });

  it('kommt mit CRLF zurecht', () => {
    const table = parseCsv('Vorname;Nachname\r\nMax;Muster\r\n');
    expect(table.rows).toEqual([['Max', 'Muster']]);
  });

  it('beachtet Anfuehrungszeichen samt Trennzeichen darin', () => {
    const table = parseCsv('Name;Ort\n"Muster, Max";Zürich');
    expect(table.rows[0]).toEqual(['Muster, Max', 'Zürich']);
  });

  it('versteht doppelte Anfuehrungszeichen als eines', () => {
    const table = parseCsv('Name\n"Max ""Maxi"" Muster"');
    expect(table.rows[0]).toEqual(['Max "Maxi" Muster']);
  });

  it('behaelt Zeilenumbrueche innerhalb eines Feldes', () => {
    const table = parseCsv('Name;Notiz\nMax;"Zeile 1\nZeile 2"');
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]?.[1]).toBe('Zeile 1\nZeile 2');
  });

  it('ueberspringt Leerzeilen', () => {
    const table = parseCsv('Vorname;Nachname\nMax;Muster\n\n\nAnna;Beispiel\n');
    expect(table.rows).toHaveLength(2);
  });

  it('liefert bei leerer Datei nichts statt zu scheitern', () => {
    expect(parseCsv('').rows).toEqual([]);
  });
});

describe('Spalten zuordnen', () => {
  it('erkennt deutsche Bezeichnungen', () => {
    expect(guessMapping(['Vorname', 'Nachname', 'PLZ', 'Ort']))
      .toEqual({ firstName: 0, lastName: 1, postalCode: 2, city: 3 });
  });

  it('erkennt englische und franzoesische Bezeichnungen', () => {
    const m = guessMapping(['First Name', 'Surname', 'E-Mail', 'NPA']);
    expect(m.firstName).toBe(0);
    expect(m.lastName).toBe(1);
    expect(m.email).toBe(2);
    expect(m.postalCode).toBe(3);
  });

  it('ignoriert Gross- und Kleinschreibung sowie Leerzeichen', () => {
    expect(guessMapping(['  VORNAME  ', 'nachname']).firstName).toBe(0);
  });

  it('ordnet dieselbe Spalte nicht zweimal zu', () => {
    const m = guessMapping(['Name', 'Nachname']);
    const indices = Object.values(m);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('laesst unbekannte Spalten offen', () => {
    expect(guessMapping(['Lieblingsfarbe'])).toEqual({});
  });
});

describe('Datum normalisieren', () => {
  it.each([
    ['31.12.1980', '1980-12-31'],
    ['1.1.1975', '1975-01-01'],
    ['1980-12-31', '1980-12-31'],
    ['31/12/1980', '1980-12-31'],
  ])('%s wird zu %s', (input, expected) => {
    expect(normalizeDate(input)).toBe(expected);
  });

  it('raet kein zweistelliges Jahr', () => {
    // Bei Geburtsdaten waere die Fehlerquote zu hoch, und ein falsches Alter
    // zieht sich durch die gesamte Vorsorgeberechnung.
    expect(normalizeDate('31.12.80')).toBeNull();
  });

  it('meldet Unlesbares statt zu raten', () => {
    expect(normalizeDate('irgendwann')).toBeNull();
  });
});

describe('Zeilen abbilden', () => {
  const table = parseCsv([
    'Vorname;Nachname;Geburtsdatum;E-Mail',
    'Max;Muster;31.12.1980;max@test.ch',
    ';Ohnevorname;01.01.1990;',
    'Anna;Beispiel;kaputt;anna@test.ch',
    'Peter;Zukunft;31.12.2099;',
  ].join('\n'));
  const rows = mapRows(table, guessMapping(table.headers));

  it('uebernimmt eine vollstaendige Zeile', () => {
    expect(rows[0]).toEqual({
      line: 2,
      values: { firstName: 'Max', lastName: 'Muster', dateOfBirth: '1980-12-31', email: 'max@test.ch' },
    });
  });

  it('bemaengelt eine Zeile ohne Vornamen', () => {
    expect(rows[1]?.error).toMatch(/Vorname oder Nachname fehlt/);
  });

  it('bemaengelt ein unlesbares Datum und nennt den Wert', () => {
    expect(rows[2]?.error).toContain('kaputt');
  });

  it('bemaengelt ein Geburtsdatum in der Zukunft', () => {
    expect(rows[3]?.error).toMatch(/Zukunft/);
  });

  it('zaehlt Zeilennummern ab der Kopfzeile', () => {
    // Der Berater sucht die fehlerhafte Zeile in seiner Tabelle - also muss
    // die Nummer zu der in Excel passen.
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4, 5]);
  });
});

/**
 * CSV-Einlesen fuer den Kundenimport.
 *
 * Bewusst selbst geschrieben statt einer Abhaengigkeit: Der Bedarf ist eng
 * umrissen, dafuer aber eigen. Exporte aus Schweizer Maklersystemen und aus
 * Excel kommen semikolongetrennt, oft mit BOM und mit CRLF - ein
 * allgemeiner Parser loest das nicht besser, kostet aber eine Abhaengigkeit
 * im Bundle.
 */

export type CsvTable = {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly delimiter: string;
};

const CANDIDATES = [';', ',', '\t', '|'] as const;

/**
 * Trennzeichen anhand der Kopfzeile raten. Excel schreibt in der Schweiz
 * standardmaessig Semikolon, weil das Komma als Dezimaltrenner belegt ist -
 * ein auf Komma festgelegter Parser scheitert an den meisten echten Dateien.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  let best: string = ';';
  let bestCount = 0;

  for (const candidate of CANDIDATES) {
    const count = splitLine(firstLine, candidate).length;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

/** Eine Zeile zerlegen, Anfuehrungszeichen und doppelte Anfuehrungszeichen beachten. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { field += '"'; i += 1; }   // "" bedeutet ein "
        else inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') { inQuotes = true; continue; }
    if (char === delimiter) { out.push(field); field = ''; continue; }
    field += char ?? '';
  }

  out.push(field);
  return out;
}

export function parseCsv(input: string): CsvTable {
  // BOM entfernen: Excel schreibt ihn, und ohne diesen Schritt heisst die
  // erste Spalte "\uFEFFVorname" und wird nie zugeordnet. Als Escape
  // geschrieben, weil das Zeichen im Quelltext unsichtbar waere.
  const text = input.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);

  // Zeilenumbrueche innerhalb von Anfuehrungszeichen gehoeren zum Feld.
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '""'; i += 1; continue; }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      lines.push(current);
      current = '';
      continue;
    }
    current += char ?? '';
  }
  if (current !== '') lines.push(current);

  const nonEmpty = lines.filter((l) => l.trim() !== '');
  if (nonEmpty.length === 0) return { headers: [], rows: [], delimiter };

  const headers = splitLine(nonEmpty[0]!, delimiter).map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((line) => splitLine(line, delimiter).map((c) => c.trim()));

  return { headers, rows, delimiter };
}

/** Felder, die der Import befuellen kann. */
export const IMPORT_FIELDS = [
  'firstName', 'lastName', 'dateOfBirth', 'email', 'phone',
  'street', 'postalCode', 'city', 'externalRef',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABEL: Record<ImportField, string> = {
  firstName: 'Vorname',
  lastName: 'Nachname',
  dateOfBirth: 'Geburtsdatum',
  email: 'E-Mail',
  phone: 'Telefon',
  street: 'Strasse',
  postalCode: 'PLZ',
  city: 'Ort',
  externalRef: 'Kennung im CRM',
};

/** Schreibweisen, die in Exporten tatsaechlich vorkommen. */
const ALIASES: Record<ImportField, readonly string[]> = {
  firstName: ['vorname', 'first name', 'firstname', 'prenom', 'prénom', 'given name'],
  lastName: ['nachname', 'name', 'last name', 'lastname', 'familienname', 'nom', 'surname'],
  dateOfBirth: ['geburtsdatum', 'geburtstag', 'date of birth', 'dob', 'geb', 'geb.', 'date de naissance'],
  email: ['email', 'e-mail', 'mail', 'e mail', 'courriel'],
  phone: ['telefon', 'tel', 'tel.', 'phone', 'mobile', 'handy', 'natel', 'téléphone'],
  street: ['strasse', 'straße', 'adresse', 'street', 'rue'],
  postalCode: ['plz', 'postleitzahl', 'zip', 'postal code', 'npa'],
  city: ['ort', 'stadt', 'city', 'wohnort', 'localité', 'localite'],
  externalRef: ['kundennummer', 'kunden-nr', 'kundennr', 'id', 'referenz', 'external ref', 'nr'],
};

/** Spalten automatisch zuordnen. Der Berater kann jede Zuordnung ueberschreiben. */
export function guessMapping(headers: readonly string[]): Partial<Record<ImportField, number>> {
  const mapping: Partial<Record<ImportField, number>> = {};
  const used = new Set<number>();

  for (const field of IMPORT_FIELDS) {
    const aliases = ALIASES[field];
    const index = headers.findIndex((header, i) => {
      if (used.has(i)) return false;
      return aliases.includes(header.trim().toLowerCase());
    });
    if (index >= 0) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

export type ParsedRow = {
  readonly line: number;
  readonly values: Partial<Record<ImportField, string>>;
  readonly error?: string;
};

/**
 * Datumsangaben aus Exporten: 31.12.1980, 1980-12-31, 31/12/1980.
 * Ein zweistelliges Jahr wird bewusst nicht geraten - bei Geburtsdaten waere
 * die Fehlerquote zu hoch und ein falsches Alter zieht sich durch die
 * gesamte Vorsorgeberechnung.
 */
export function normalizeDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) return v;

  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(v);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }
  return null;
}

export function mapRows(
  table: CsvTable,
  mapping: Partial<Record<ImportField, number>>,
): ParsedRow[] {
  return table.rows.map((cells, i) => {
    const values: Partial<Record<ImportField, string>> = {};

    for (const field of IMPORT_FIELDS) {
      const index = mapping[field];
      if (index === undefined) continue;
      const raw = cells[index]?.trim();
      if (raw) values[field] = raw;
    }

    const line = i + 2;   // Kopfzeile ist Zeile 1

    if (!values.firstName || !values.lastName) {
      return { line, values, error: 'Vorname oder Nachname fehlt' };
    }

    if (values.dateOfBirth) {
      const normalized = normalizeDate(values.dateOfBirth);
      if (!normalized) {
        return { line, values, error: `Geburtsdatum "${values.dateOfBirth}" nicht lesbar` };
      }
      if (new Date(normalized) > new Date()) {
        return { line, values, error: 'Geburtsdatum liegt in der Zukunft' };
      }
      return { line, values: { ...values, dateOfBirth: normalized } };
    }

    return { line, values };
  });
}

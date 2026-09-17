/**
 * Praemien der Grundversicherung, entpackt und gefiltert.
 *
 * Die Daten des BAG liegen je Kanton als gepackte Bytefolge im Projekt:
 * 217'472 Zeilen waeren als Text 21 MB, gepackt sind es 3,3 MB - und
 * geladen wird immer nur der eine Kanton, um den es geht.
 *
 * Zwoelf Bytes je Zeile: sieben Kennzahlen als je ein Byte, dann die
 * Praemie in Rappen als vier Bytes. Alles, was sich wiederholt -
 * Versicherer, Produktname, Tariftyp - steht einmal im Verzeichnis und
 * hier nur als Nummer.
 */

export const ROW_BYTES = 12;

export type PremiumCatalogue = {
  readonly year: number;
  /** Versicherernummern des BAG, in derselben Reihenfolge wie die Nummern in den Zeilen. */
  readonly insurers: readonly number[];
  readonly products: readonly string[];
  readonly ageGroups: readonly string[];
  readonly accident: readonly string[];
  readonly tariffTypes: readonly string[];
  readonly franchises: readonly number[];
  readonly cantons: readonly string[];
};

export type PremiumRow = {
  readonly insurerNumber: number;
  readonly region: number;
  readonly ageGroup: string;
  readonly withAccident: boolean;
  readonly tariffType: string;
  readonly product: string;
  readonly franchise: number;
  /** Monatspraemie in Rappen. */
  readonly premiumCents: number;
};

export type PremiumQuery = {
  readonly region: number;
  readonly ageGroup: string;
  readonly withAccident: boolean;
  readonly franchise: number;
  /** Leer: alle Modelle. Sonst nur die genannten Tariftypen. */
  readonly tariffTypes?: readonly string[];
};

/**
 * Die Altersklasse aus dem Geburtsdatum.
 *
 * Kind bis 18, junger Erwachsener bis 25, danach Erwachsener - die
 * Grenzen des KVG. Gerechnet wird auf den Stichtag, nicht auf heute: eine
 * Praemie fuer 2026 gilt fuer das Alter im Jahr 2026.
 */
export function ageGroupFor(birthDate: string, onDate: string): string | null {
  const born = new Date(`${birthDate}T12:00:00Z`);
  const at = new Date(`${onDate}T12:00:00Z`);
  if (Number.isNaN(born.getTime()) || Number.isNaN(at.getTime())) return null;

  let age = at.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    at.getUTCMonth() < born.getUTCMonth()
    || (at.getUTCMonth() === born.getUTCMonth() && at.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;

  if (age < 0) return null;
  if (age <= 18) return 'AKL-KIN';
  if (age <= 25) return 'AKL-JUG';
  return 'AKL-ERW';
}

/** Franchisen, die es fuer diese Altersklasse gibt (KVV Art. 93). */
export function franchisesFor(ageGroup: string, all: readonly number[]): readonly number[] {
  return ageGroup === 'AKL-KIN'
    ? all.filter((f) => f <= 600)
    : all.filter((f) => f === 300 || f >= 500);
}

export function decodeRow(
  buffer: Uint8Array, index: number, catalogue: PremiumCatalogue,
): PremiumRow | null {
  const o = index * ROW_BYTES;
  if (o + ROW_BYTES > buffer.length) return null;

  const insurerNumber = catalogue.insurers[buffer[o] ?? -1];
  const ageGroup = catalogue.ageGroups[buffer[o + 2] ?? -1];
  const tariffType = catalogue.tariffTypes[buffer[o + 4] ?? -1];
  const product = catalogue.products[buffer[o + 5] ?? -1];
  const franchise = catalogue.franchises[buffer[o + 6] ?? -1];
  if (insurerNumber === undefined || ageGroup === undefined || tariffType === undefined
      || product === undefined || franchise === undefined) return null;

  const view = new DataView(buffer.buffer, buffer.byteOffset + o + 8, 4);

  return {
    insurerNumber,
    region: buffer[o + 1] ?? 0,
    ageGroup,
    withAccident: (buffer[o + 3] ?? 0) === 1,
    tariffType,
    product,
    franchise,
    premiumCents: view.getUint32(0, true),
  };
}

/**
 * Die passenden Praemien, guenstigste zuerst.
 *
 * Gefiltert wird beim Entpacken und nicht danach: aus siebzehntausend
 * Zeilen eines Kantons bleiben so ein paar Dutzend uebrig, ohne dass
 * dazwischen eine Liste mit allen entsteht.
 */
export function queryPremiums(
  buffer: Uint8Array, catalogue: PremiumCatalogue, query: PremiumQuery,
): readonly PremiumRow[] {
  const ageIndex = catalogue.ageGroups.indexOf(query.ageGroup);
  const franchiseIndex = catalogue.franchises.indexOf(query.franchise);
  if (ageIndex < 0 || franchiseIndex < 0) return [];

  const accident = query.withAccident ? 1 : 0;
  const types = query.tariffTypes && query.tariffTypes.length > 0
    ? new Set(query.tariffTypes.map((t) => catalogue.tariffTypes.indexOf(t)))
    : null;

  const out: PremiumRow[] = [];
  for (let i = 0; i * ROW_BYTES < buffer.length; i += 1) {
    const o = i * ROW_BYTES;
    if (buffer[o + 1] !== query.region) continue;
    if (buffer[o + 2] !== ageIndex) continue;
    if (buffer[o + 3] !== accident) continue;
    if (buffer[o + 6] !== franchiseIndex) continue;
    if (types && !types.has(buffer[o + 4] ?? -1)) continue;

    const row = decodeRow(buffer, i, catalogue);
    if (row) out.push(row);
  }

  return out.sort((a, b) => a.premiumCents - b.premiumCents);
}

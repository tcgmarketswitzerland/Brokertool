/**
 * Von der Postleitzahl zur Praemienregion.
 *
 * Die Praemie der Grundversicherung haengt an Kanton und Praemienregion,
 * nicht an der Postleitzahl. Das BAG fuehrt die Zuordnung ueber die
 * BFS-Gemeindenummer; beim Kunden steht aber eine PLZ auf dem Brief.
 *
 * Die Zuordnung ist nicht eindeutig: 1103 von 3178 Postleitzahlen liegen in
 * mehreren Gemeinden, und 6340 verteilt sich sogar ueber zwei Kantone
 * (Hausen am Albis ZH und Baar ZG). Diese Funktion gibt deshalb immer eine
 * Liste zurueck - im Gespraech waehlt der Berater die Gemeinde. Eine
 * Funktion, die hier die erste Zeile naehme, lieferte eine falsche Praemie,
 * ohne dass es jemandem auffiele.
 */

/** [Kanton, Praemienregion, Gemeinde] - so liegt die Nachschlagetabelle vor. */
export type RegionEntry = readonly [string, number, string];

export type PremiumRegion = {
  readonly canton: string;
  /** 0 bis 3. Fuenfzehn Kantone haben nur die Region 0. */
  readonly region: number;
  readonly municipality: string;
  /** Kennung wie in den BAG-Daten: "PR-REG CH0". */
  readonly code: string;
};

export type RegionTable = Readonly<Record<string, readonly RegionEntry[]>>;

export function regionCode(region: number): string {
  return `PR-REG CH${region}`;
}

/** Postleitzahl bereinigen: "8004 Zürich" und " 8004 " ergeben beide "8004". */
export function normalisePostalCode(input: string): string | null {
  const match = input.trim().match(/\b(\d{4})\b/);
  return match ? (match[1] ?? null) : null;
}

export function lookupRegions(table: RegionTable, postalCode: string): readonly PremiumRegion[] {
  const plz = normalisePostalCode(postalCode);
  if (plz === null) return [];

  const entries = table[plz] ?? [];
  return entries.map(([canton, region, municipality]) => ({
    canton, region, municipality, code: regionCode(region),
  }));
}

/**
 * Ob die Postleitzahl allein genuegt.
 *
 * Mehrere Gemeinden in derselben Region sind kein Problem - die Praemie ist
 * dieselbe. Erst verschiedene Regionen oder Kantone erzwingen eine Wahl.
 */
export function isAmbiguous(regions: readonly PremiumRegion[]): boolean {
  return new Set(regions.map((r) => `${r.canton}-${r.region}`)).size > 1;
}

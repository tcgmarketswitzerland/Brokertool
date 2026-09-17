/**
 * Vorsorgeanalyse nach dem Schweizer Drei-Saeulen-System.
 *
 * Grundsatzentscheidung: Dieses Modul rechnet nicht aus gesetzlichen
 * Tabellen, sondern aus Zahlen, die der Berater eintraegt. Die Vorlage
 * dafuer ist der Vorsorgeausweis - dort stehen Invalidenrente,
 * Invaliden-Kinderrente, Ehegattenrente und Waisenrente als Betraege. Der
 * Berater liest sie ab, das Werkzeug summiert und stellt dar.
 *
 * Das ist bewusst so:
 *   - Eine Grobanalyse, die AHV- und BVG-Renten selbst herleitet, ist nur
 *     so gut wie ihre Parameter. Sind sie ein Jahr alt, rechnet sie falsch,
 *     ohne dass es jemand merkt - und der Berater haftet fuer die Zahl.
 *   - Der Vorsorgeausweis des Kunden ist genauer als jede Schaetzung.
 *   - Was der Berater eingetragen hat, kann er im Streitfall belegen.
 *
 * Das Werkzeug leistet dafuer das, was am Tisch niemand im Kopf macht:
 * Kinderrenten mal Anzahl Kinder, Summe je Fall, Vergleich mit dem Ziel,
 * und die Trennung von Unfall und Krankheit.
 */

/** Die vier Faelle, die eine Vorsorgeanalyse auseinanderhaelt. */
export const PENSION_CASES = ['DEATH', 'DISABILITY_ILLNESS', 'DISABILITY_ACCIDENT', 'RETIREMENT'] as const;
export type PensionCase = (typeof PENSION_CASES)[number];

export const PENSION_CASE_LABEL: Record<PensionCase, string> = {
  DEATH: 'Tod',
  DISABILITY_ILLNESS: 'Erwerbsunfähigkeit durch Krankheit',
  DISABILITY_ACCIDENT: 'Erwerbsunfähigkeit durch Unfall',
  RETIREMENT: 'Alter',
};

export const PENSION_CASE_SHORT: Record<PensionCase, string> = {
  DEATH: 'Tod',
  DISABILITY_ILLNESS: 'Krankheit',
  DISABILITY_ACCIDENT: 'Unfall',
  RETIREMENT: 'Alter',
};

/**
 * Die Saeulen, getrennt dargestellt.
 *
 * UVG steht neben der ersten Saeule und nicht darin: es ist eine eigene
 * Versicherung mit eigener Leistung, und genau ihr Fehlen bei Krankheit
 * ist die Luecke, um die es geht. In einen Topf geworfen waere der
 * Unterschied unsichtbar - und damit die ganze Analyse wertlos.
 */
export const PILLARS = ['UVG', 'PILLAR_1', 'PILLAR_2', 'PILLAR_3', 'OTHER'] as const;
export type Pillar = (typeof PILLARS)[number];

export const PILLAR_LABEL: Record<Pillar, string> = {
  PILLAR_1: '1. Säule (AHV/IV)',
  UVG: 'Unfallversicherung (UVG)',
  PILLAR_2: '2. Säule (Pensionskasse)',
  PILLAR_3: '3. Säule (privat)',
  OTHER: 'Weitere Leistungen',
};

export const PILLAR_SHORT: Record<Pillar, string> = {
  PILLAR_1: '1. Säule',
  UVG: 'UVG',
  PILLAR_2: '2. Säule',
  PILLAR_3: '3. Säule',
  OTHER: 'Weitere',
};

/** Der Haushalt bestimmt, welche Renten ueberhaupt anfallen. */
export type Household = {
  /** Bruttojahreseinkommen der versicherten Person, in Rappen. */
  readonly annualIncomeCents: number | null;
  readonly hasPartner: boolean;
  /** Erwerbseinkommen der Partnerin oder des Partners, in Rappen. */
  readonly partnerIncomeCents: number | null;
  /** Kinder mit Anspruch auf Kinder- beziehungsweise Waisenrenten. */
  readonly childCount: number;
  /**
   * Gewuenschte Absicherung in Prozent des Bruttoeinkommens. Leer, bis der
   * Berater sie mit dem Kunden festlegt - eine Vorgabe waere eine Aussage,
   * die niemand getroffen hat.
   */
  readonly targetPercent: number | null;
};

/**
 * Eine eingetragene Leistung.
 *
 * `perChild` trennt, was mit der Kinderzahl waechst, von dem, was fest
 * ist. Ohne diese Trennung muesste der Berater im Kopf multiplizieren -
 * genau die Rechnung, die am Tisch schiefgeht.
 */
export type Benefit = {
  readonly pillar: Pillar;
  readonly label: string;
  /** Jahresbetrag in Rappen, unabhaengig von der Kinderzahl. */
  readonly annualCents: number;
  /** Jahresbetrag je Kind in Rappen. */
  readonly perChildCents: number;
  /** Nur bei vorhandener Partnerin oder vorhandenem Partner. */
  readonly requiresPartner: boolean;
};

export type PensionInput = {
  readonly household: Household;
  readonly benefits: Readonly<Record<PensionCase, readonly Benefit[]>>;
};

export function emptyBenefit(pillar: Pillar, label: string): Benefit {
  return { pillar, label, annualCents: 0, perChildCents: 0, requiresPartner: false };
}

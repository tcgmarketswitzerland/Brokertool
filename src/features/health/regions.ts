import 'server-only';
import table from '@/data/premium-regions.json';
import {
  lookupRegions, type PremiumRegion, type RegionTable,
} from '@/domain/health/premium-region';

/**
 * Die Nachschlagetabelle des BAG, Stand Praemienjahr 2026.
 *
 * Sie liegt als Datei im Projekt und nicht in der Datenbank: sie aendert
 * einmal im Jahr, gehoert zu keinem Mandanten, und als Teil des Codes ist
 * jederzeit nachvollziehbar, mit welchem Stand eine Beratung gearbeitet
 * hat. Rund 130 KB, die nur auf dem Server geladen werden.
 *
 * Quelle: Bundesamt fuer Gesundheit, "Praemienregionen gueltig ab
 * 01.01.2026 bis 31.12.2026", Blatt A_COM.
 */
export const PREMIUM_YEAR = 2026;

export function findRegions(postalCode: string): readonly PremiumRegion[] {
  return lookupRegions(table as unknown as RegionTable, postalCode);
}

import 'server-only';
import catalogue from '@/data/premiums/index.json';
import insurerRegister from '@/data/health-insurers.json';
import {
  queryPremiums, type PremiumCatalogue, type PremiumQuery, type PremiumRow,
} from '@/domain/health/premiums';

/**
 * Praemien laden - immer nur der eine Kanton, um den es geht.
 *
 * Der dynamische Import statt eines festen: sonst laege der ganze
 * Datensatz aller Kantone im Speicher jeder Serverinstanz, auch wenn eine
 * Beratung nie mehr als einen Kanton braucht.
 */
export const PREMIUM_CATALOGUE = catalogue as PremiumCatalogue;

export type PremiumOffer = PremiumRow & {
  readonly insurerName: string;
};

const register = insurerRegister as Record<string, { name: string; uid: string; group: string }>;

export function insurerName(number: number): string {
  return register[String(number)]?.name ?? `Versicherer ${number}`;
}

export async function findPremiums(
  canton: string, query: PremiumQuery,
): Promise<readonly PremiumOffer[]> {
  if (!PREMIUM_CATALOGUE.cantons.includes(canton)) return [];

  const file = (await import(`@/data/premiums/${canton}.json`)) as
    { default: { rows: number; data: string } };
  const buffer = Buffer.from(file.default.data, 'base64');

  return queryPremiums(buffer, PREMIUM_CATALOGUE, query)
    .map((row) => ({ ...row, insurerName: insurerName(row.insurerNumber) }));
}

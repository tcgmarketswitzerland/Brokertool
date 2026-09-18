'use server';

import { z } from 'zod';
import { findRegions, PREMIUM_YEAR } from './regions';
import { findPremiums, PREMIUM_CATALOGUE, type PremiumOffer } from './premiums';
import { normalisePostalCode, type PremiumRegion } from '@/domain/health/premium-region';

/**
 * Praemien der Grundversicherung suchen.
 *
 * Zwei moegliche Antworten, und die zweite ist der Grund fuer diesen
 * Zuschnitt: liegt eine Postleitzahl in mehreren Praemienregionen - das
 * betrifft ein Drittel aller Postleitzahlen -, dann gibt es keine richtige
 * Praemie, sondern eine Wahl. Die trifft der Berater, nicht der Code.
 */
export type PremiumSearchResult =
  | { kind: 'unknown_postal_code' }
  | { kind: 'choose_region'; regions: readonly PremiumRegion[] }
  | {
      kind: 'offers';
      region: PremiumRegion;
      year: number;
      offers: readonly PremiumOffer[];
    };

const schema = z.object({
  postalCode: z.string().max(40),
  ageGroup: z.enum(['AKL-KIN', 'AKL-JUG', 'AKL-ERW']),
  franchise: z.number().int().min(0).max(2500),
  withAccident: z.boolean(),
  tariffTypes: z.array(z.string().max(20)).max(6),
  /** Gesetzt, sobald der Berater die Gemeinde gewaehlt hat. */
  canton: z.string().length(2).optional(),
  region: z.number().int().min(0).max(3).optional(),
});

export async function searchPremiums(payload: unknown): Promise<PremiumSearchResult> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { kind: 'unknown_postal_code' };
  const v = parsed.data;

  let region: PremiumRegion | undefined;

  if (v.canton && v.region !== undefined) {
    region = { canton: v.canton, region: v.region, municipality: '',
               code: `PR-REG CH${v.region}` };
  } else {
    const plz = normalisePostalCode(v.postalCode);
    if (plz === null) return { kind: 'unknown_postal_code' };

    const found = findRegions(plz);
    if (found.length === 0) return { kind: 'unknown_postal_code' };

    // Mehrere Gemeinden in derselben Region sind kein Problem - die
    // Praemie ist dieselbe. Erst verschiedene Regionen erzwingen die Wahl.
    const distinct = new Map(found.map((r) => [`${r.canton}-${r.region}`, r]));
    if (distinct.size > 1) return { kind: 'choose_region', regions: found };
    region = [...distinct.values()][0];
  }

  if (!region) return { kind: 'unknown_postal_code' };

  const offers = await findPremiums(region.canton, {
    region: region.region,
    ageGroup: v.ageGroup,
    withAccident: v.withAccident,
    franchise: v.franchise,
    tariffTypes: v.tariffTypes,
  });

  return { kind: 'offers', region, year: PREMIUM_CATALOGUE.year || PREMIUM_YEAR, offers };
}

import type { PensionCase, Pillar } from '@/domain/pension/types';

/**
 * Welche Zeilen der Berater je Fall ausfuellt.
 *
 * Die Bezeichnungen folgen dem Vorsorgeausweis: dort stehen genau diese
 * Posten, und der Berater soll abschreiben statt zuordnen. Wo der Ausweis
 * eine Rente je Kind ausweist, gibt es ein eigenes Feld - multipliziert
 * wird nicht im Kopf.
 */

export type BenefitRow = {
  readonly key: string;
  readonly pillar: Pillar;
  readonly label: string;
  readonly hint?: string;
  readonly perChild: boolean;
  readonly requiresPartner: boolean;
};

const row = (
  key: string, pillar: Pillar, label: string,
  options: { hint?: string; perChild?: boolean; partner?: boolean } = {},
): BenefitRow => ({
  key, pillar, label,
  ...(options.hint === undefined ? {} : { hint: options.hint }),
  perChild: options.perChild ?? false,
  requiresPartner: options.partner ?? false,
});

export const BENEFIT_ROWS: Record<PensionCase, readonly BenefitRow[]> = {
  DEATH: [
    row('ahv_witwen', 'PILLAR_1', 'Witwen- oder Witwerrente', { partner: true }),
    row('ahv_waisen', 'PILLAR_1', 'Waisenrente', { perChild: true, hint: 'je Kind' }),
    row('bvg_partner', 'PILLAR_2', 'Ehegatten- oder Lebenspartnerrente', { partner: true }),
    row('bvg_waisen', 'PILLAR_2', 'Waisenrente', { perChild: true, hint: 'je Kind' }),
    row('uvg_tod', 'UVG', 'Hinterlassenenrente UVG', { hint: 'nur bei Unfalltod' }),
    row('p3_tod', 'PILLAR_3', 'Rente aus 3. Säule'),
    row('weitere_tod', 'OTHER', 'Weitere Leistungen'),
  ],
  DISABILITY_ILLNESS: [
    row('ktg_krank', 'OTHER', 'Krankentaggeld', { hint: 'auf ein Jahr gerechnet' }),
    row('iv_krank', 'PILLAR_1', 'IV-Rente'),
    row('iv_kind_krank', 'PILLAR_1', 'IV-Kinderrente', { perChild: true, hint: 'je Kind' }),
    row('bvg_krank', 'PILLAR_2', 'Invalidenrente Pensionskasse'),
    row('bvg_kind_krank', 'PILLAR_2', 'Invaliden-Kinderrente', { perChild: true, hint: 'je Kind' }),
    row('p3_krank', 'PILLAR_3', 'Erwerbsunfähigkeitsrente 3. Säule'),
  ],
  DISABILITY_ACCIDENT: [
    row('uvg_taggeld', 'UVG', 'UVG-Taggeld oder Invalidenrente'),
    row('iv_unfall', 'PILLAR_1', 'IV-Rente'),
    row('iv_kind_unfall', 'PILLAR_1', 'IV-Kinderrente', { perChild: true, hint: 'je Kind' }),
    row('bvg_unfall', 'PILLAR_2', 'Invalidenrente Pensionskasse'),
    row('bvg_kind_unfall', 'PILLAR_2', 'Invaliden-Kinderrente', { perChild: true, hint: 'je Kind' }),
    row('p3_unfall', 'PILLAR_3', 'Erwerbsunfähigkeitsrente 3. Säule'),
  ],
  RETIREMENT: [
    row('ahv_alter', 'PILLAR_1', 'AHV-Altersrente'),
    row('ahv_alter_partner', 'PILLAR_1', 'AHV-Rente Partnerin oder Partner', { partner: true }),
    row('bvg_alter', 'PILLAR_2', 'Altersrente Pensionskasse'),
    row('p3_alter', 'PILLAR_3', 'Rente aus 3. Säule'),
    row('weitere_alter', 'OTHER', 'Weitere Einkünfte', { hint: 'Vermögen, Mieteinnahmen' }),
  ],
};

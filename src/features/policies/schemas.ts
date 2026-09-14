import { z } from 'zod';
import { POLICY_STATUSES, PREMIUM_FREQUENCIES } from '@/domain/policy/types';

/** Betraege kommen als Franken herein und werden als Rappen gespeichert. */
const franken = z.string().optional().transform((v, ctx) => {
  if (v === undefined || v.trim() === '') return undefined;
  const cleaned = v.replace(/['\s’]/g, '').replace(',', '.');
  const num = Number(cleaned);
  if (Number.isNaN(num) || num < 0) {
    ctx.addIssue({ code: 'custom', message: 'Kein gültiger Betrag' });
    return z.NEVER;
  }
  return Math.round(num * 100);
});

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v === '' ? undefined : v));

const optionalDate = z.string().optional()
  .transform((v) => (v === '' ? undefined : v))
  .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), 'Kein gültiges Datum');

/**
 * Pflicht sind Versicherer und Praemie (ADR-001). Alles Weitere ist
 * optional, weil der Kunde im Gespraech die Police meist nicht dabei hat.
 */
export const policySchema = z.object({
  customerId: z.uuid(),
  topicId: z.uuid(),
  personId: z.union([z.uuid(), z.literal('')]).optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),

  insurerId: z.union([z.uuid(), z.literal('')]).optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  insurerName: optionalText(150),

  productName: optionalText(150),
  policyNumber: optionalText(80),
  status: z.enum(POLICY_STATUSES).default('ACTIVE'),

  startDate: optionalDate,
  endDate: optionalDate,
  premium: franken,
  premiumFrequency: z.enum(PREMIUM_FREQUENCIES).default('YEARLY'),
  sumInsured: franken,
  deductible: franken,
  noticePeriodMonths: z.string().optional().transform((v, ctx) => {
    if (v === undefined || v.trim() === '') return undefined;
    const num = Number(v);
    if (!Number.isInteger(num) || num < 0 || num > 24) {
      ctx.addIssue({ code: 'custom', message: 'Zwischen 0 und 24 Monaten' });
      return z.NEVER;
    }
    return num;
  }),
}).refine(
  (v) => v.insurerId !== undefined || (v.insurerName ?? '').length > 0,
  { message: 'Versicherer fehlt', path: ['insurerName'] },
).refine(
  (v) => !v.startDate || !v.endDate || v.endDate >= v.startDate,
  { message: 'Ablauf liegt vor Beginn', path: ['endDate'] },
);

export type PolicyActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string; fields?: Record<string, string> };

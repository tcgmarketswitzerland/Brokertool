import { z } from 'zod';
import {
  CUSTOMER_TYPES, EMPLOYMENT_TYPES, LANGUAGES, MARITAL_STATUSES, PERSON_ROLES, SEXES,
} from '@/domain/customer/types';

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max).optional().transform((v) => (v === '' ? undefined : v));

/**
 * Schnellanlage: Vorname, Nachname, sonst nichts.
 *
 * Der haeufigste Grund, warum solche Werkzeuge liegen bleiben, ist die
 * Doppelerfassung (Analyse 1.1). Alles, was nicht zwingend ist, wird
 * deshalb im Gespraech dort erfasst, wo es gebraucht wird - nicht vorab
 * in einem Stammdatenformular.
 */
export const quickCreateSchema = z.object({
  firstName: trimmed(100).min(1, 'Vorname fehlt'),
  lastName: trimmed(100).min(1, 'Nachname fehlt'),
  dateOfBirth: z.string().optional()
    .transform((v) => (v === '' ? undefined : v))
    .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), 'Kein gültiges Datum'),
  customerType: z.enum(CUSTOMER_TYPES).default('PRIVATE'),
});

export const customerSchema = z.object({
  customerType: z.enum(CUSTOMER_TYPES),
  correspondenceLanguage: z.enum(LANGUAGES).default('de'),
  externalRef: optionalText(100),
});

/** Betraege kommen als Franken herein und werden in Rappen gespeichert. */
const frankenToRappen = z.string().optional().transform((v, ctx) => {
  if (v === undefined || v.trim() === '') return undefined;
  const cleaned = v.replace(/['\s]/g, '').replace(',', '.');
  const num = Number(cleaned);
  if (Number.isNaN(num) || num < 0) {
    ctx.addIssue({ code: 'custom', message: 'Kein gültiger Betrag' });
    return z.NEVER;
  }
  return Math.round(num * 100);
});

export const personSchema = z.object({
  personRole: z.enum(PERSON_ROLES).default('PRIMARY'),
  firstName: trimmed(100).min(1, 'Vorname fehlt'),
  lastName: trimmed(100).min(1, 'Nachname fehlt'),
  dateOfBirth: z.string().optional().transform((v) => (v === '' ? undefined : v)),
  sex: z.enum(SEXES).default('UNSPECIFIED'),
  maritalStatus: z.enum(MARITAL_STATUSES).optional().or(z.literal('').transform(() => undefined)),
  phone: optionalText(50),
  email: z.string().optional()
    .transform((v) => (v === '' ? undefined : v?.trim().toLowerCase()))
    .refine((v) => v === undefined || z.string().email().safeParse(v).success,
            'Keine gültige E-Mail-Adresse'),
  occupation: optionalText(120),
  employer: optionalText(120),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional().or(z.literal('').transform(() => undefined)),
  annualIncome: frankenToRappen,
});

export const addressSchema = z.object({
  street: optionalText(150),
  streetNumber: optionalText(20),
  postalCode: optionalText(10),
  city: optionalText(100),
  country: trimmed(2).default('CH'),
});

/**
 * Vollstaendige Erfassung in einem Formular.
 *
 * Die Schnellanlage bleibt fuer den Fall "Name reicht". Wer aber eine
 * Beratung ansetzt, hat die Angaben ohnehin vor sich - und muss sie dann
 * nicht ueber drei Formulare verteilt nachtragen. Die Rueckmeldung aus dem
 * ersten Test war eindeutig: erst Name, dann Person, dann Adresse fuehlt
 * sich an wie Arbeit, die das Werkzeug erfinden.
 */
export const fullCustomerSchema = z.object({
  customerType: z.enum(CUSTOMER_TYPES).default('PRIVATE'),
  correspondenceLanguage: z.enum(LANGUAGES).default('de'),
  person: personSchema,
  address: addressSchema,
});

export type CustomerActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string; fields?: Record<string, string> };

export function fieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

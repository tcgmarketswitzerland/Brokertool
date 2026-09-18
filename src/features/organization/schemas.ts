import { z } from 'zod';

const optional = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v === '' || v === undefined ? null : v));

/**
 * Die Firmenangaben fuers Protokoll.
 *
 * Nur der Name ist Pflicht. Adresse und Kontakt gehoeren auf ein Dokument,
 * das der Kunde behaelt - aber eine Firma, die gerade erst angelegt wurde,
 * soll trotzdem beraten koennen.
 */
export const companySchema = z.object({
  name: z.string().trim().min(2, 'Bitte den Firmennamen angeben.').max(200),
  street: optional(150),
  postalCode: z.string().trim().optional().transform((v, ctx) => {
    if (v === undefined || v === '') return null;
    if (!/^[1-9][0-9]{3}$/.test(v)) {
      ctx.addIssue({ code: 'custom', message: 'Vierstellige Schweizer Postleitzahl' });
      return z.NEVER;
    }
    return v;
  }),
  city: optional(100),
  phone: optional(40),
  email: z.string().trim().optional().transform((v, ctx) => {
    if (v === undefined || v === '') return null;
    if (!z.email().safeParse(v).success) {
      ctx.addIssue({ code: 'custom', message: 'Keine gültige E-Mail-Adresse' });
      return z.NEVER;
    }
    return v;
  }),
  website: z.string().trim().optional().transform((v, ctx) => {
    if (v === undefined || v === '') return null;
    // Ohne Schema ergaenzen: niemand tippt "https://" in ein Formular.
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    if (!z.url().safeParse(withScheme).success) {
      ctx.addIssue({ code: 'custom', message: 'Keine gültige Adresse' });
      return z.NEVER;
    }
    return withScheme;
  }),
  finmaNumber: optional(60),
  requireMfa: z.union([z.literal('on'), z.literal('')]).optional()
    .transform((v) => v === 'on'),
});

/** Nur die Hausfarbe; das Logo kommt als Datei und nicht als Feld. */
export const brandingSchema = z.object({
  brandColor: z.string().trim().optional().transform((v, ctx) => {
    if (v === undefined || v === '') return null;
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
      ctx.addIssue({ code: 'custom', message: 'Farbe als Hexwert, z. B. #0F766E' });
      return z.NEVER;
    }
    return v.toLowerCase();
  }),
});

export type OrganizationActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string; fields?: Record<string, string> };

import { z } from 'zod';

/** Fachliche Regeln fuer Anmeldung und Registrierung. Gelten im Browser und auf dem Server. */

export const emailSchema = z
  .string()
  .min(1, 'E-Mail-Adresse fehlt')
  .email('Keine gültige E-Mail-Adresse')
  .transform((v) => v.trim().toLowerCase());

// Laenge vor Komplexitaet: eine lange Passphrase ist sicherer und leichter
// zu merken als "Pa$$w0rd". Wir pruefen deshalb nur eine Mindestlaenge und
// verzichten auf Zeichenklassenregeln, die Nutzer zu Mustern verleiten.
export const passwordSchema = z
  .string()
  .min(12, 'Mindestens 12 Zeichen')
  .max(200, 'Höchstens 200 Zeichen');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Passwort fehlt'),
});

export const signUpSchema = z.object({
  fullName: z.string().min(1, 'Name fehlt').max(120).transform((v) => v.trim()),
  email: emailSchema,
  password: passwordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

/** Rueckgabe der Auth-Aktionen an das Formular. */
export type AuthState =
  | { status: 'idle' }
  | { status: 'error'; message: string; fields?: Partial<Record<string, string>> };

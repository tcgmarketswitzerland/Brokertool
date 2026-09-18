import { z } from 'zod';
import { emailSchema } from '@/features/auth/schemas';

export const ORG_ROLES = ['OWNER', 'ADMIN', 'ADVISOR', 'BACKOFFICE'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: 'Inhaber',
  ADMIN: 'Administrator',
  ADVISOR: 'Berater',
  BACKOFFICE: 'Backoffice',
};

export const ROLE_DESCRIPTION: Record<OrgRole, string> = {
  OWNER: 'Alles, inklusive Firma, Abrechnung und Benutzerverwaltung.',
  ADMIN: 'Kunden, Beratungen und Benutzer. Keine Abrechnung.',
  ADVISOR: 'Kunden und Beratungen führen, Beratungen abschliessen.',
  BACKOFFICE: 'Kunden, Verträge und Aufgaben pflegen. Führt keine Beratung.',
};

const optional = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v === '' || v === undefined ? null : v));

/**
 * Der Adminaccount erfasst den Berater, nicht der Berater sich selbst.
 *
 * Name, Jobtitel und FINMA-Nummer stehen spaeter im Beratungsprotokoll.
 * Sie gehoeren deshalb in die Einladung und nicht in ein Namensfeld, das
 * der Eingeladene bei der Anmeldung frei ausfuellt.
 */
export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(ORG_ROLES),
  firstName: z.string().trim().min(2, 'Bitte den Vornamen angeben.').max(100),
  lastName: z.string().trim().min(2, 'Bitte den Nachnamen angeben.').max(100),
  jobTitle: optional(100),
  finmaNumber: optional(60),
});

export const changeRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(ORG_ROLES),
});

export const memberIdSchema = z.object({ memberId: z.string().uuid() });

export type ActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string; inviteUrl?: string }
  | { status: 'error'; message: string };
